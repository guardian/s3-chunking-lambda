import {Readable} from "stream";
import {WriteStream} from "fs";
import {ReadLine} from "readline";
import {ManagedUpload} from "aws-sdk/lib/s3/managed_upload";
import {PromiseResult} from "aws-sdk/lib/request";
import {AWSError} from "aws-sdk/lib/error";
import {CopyObjectOutput} from "aws-sdk/clients/s3";

let fs = require('fs');
let readline = require('readline');
let AWS = require('aws-sdk');
let s3 = new AWS.S3();

let MaxBytes = parseInt(process.env.MaxObjectSize)*1000*1000;

export async function handler(event) {
    return Promise.all(
        event.Records.map(record => {
            let bucket = record.s3.bucket.name;
            let key = record.s3.object.key.replace(/%3A/g, ':');
            let sizeBytes = record.s3.object.size;

            console.log(`Copying ${bucket}/${key} with size ${sizeBytes}`);

            if (sizeBytes > MaxBytes) {
                return splitFile(bucket, key)
            } else {
                return copy(bucket, key)
            }
        })
    )
}

/**
 * Streams the source file, splitting it into files with size ~MaxBytes and streaming each to the target bucket.
 * Note - the result is non-deterministic because output file sizes and even the number of files may vary,
 * but all of the data will be copied.
 */
function splitFile(sourceBucket: string, key: string): Promise<Array<ManagedUpload.SendData>> {
    let buildFileName = (suffix: number) => `${key}_chunk-${suffix}`;

    let fileNumber = 0;

    let inputStream: Readable = s3.getObject({
        Bucket: sourceBucket,
        Key: key
    }).createReadStream();

    let reader: ReadLine = readline.createInterface({
        input: inputStream
    });

    let outputStream: WriteStream = fs.createWriteStream(`/tmp/${buildFileName(fileNumber)}`);

    let readerResult: Promise<Array<Promise<ManagedUpload.SendData>>> = new Promise((resolve, reject) => {
        let s3UploadResults: Array<Promise<ManagedUpload.SendData>> = [];

        let uploadToS3 = (n: number) => {
            let readStream = fs.createReadStream(`/tmp/${buildFileName(n)}`);
            let s3UploadResult: Promise<ManagedUpload.SendData> = s3.upload({
                Bucket: process.env.Bucket,
                Key: `${sourceBucket}/${buildFileName(n)}`,
                Body: readStream
            }).promise();

            s3UploadResults.push(s3UploadResult);
        };

        reader.on('line', (line: string) => {
            outputStream.write(line + '\n');

            if (outputStream.bytesWritten > MaxBytes) {
                //Begin writing to a new file stream before closing the old one
                let oldOutputStream = outputStream;
                outputStream = fs.createWriteStream(`/tmp/${buildFileName(fileNumber + 1)}`);

                oldOutputStream.end();
                uploadToS3(fileNumber++);
            }
        });

        reader.on('close', () => {
            outputStream.end();
            uploadToS3(fileNumber);
            resolve(s3UploadResults);
        });
    });

    return readerResult.then(uploadResults => Promise.all(uploadResults))
}

function copy(sourceBucket: string, key: string): Promise<PromiseResult<CopyObjectOutput, AWSError>> {
    return s3.copyObject({
        Bucket: process.env.Bucket,
        CopySource: `${sourceBucket}/${key}`,
        Key: `${sourceBucket}/${key}`
    }).promise()
}
