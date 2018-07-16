import {Readable} from "stream";

let fs = require('fs');
let readline = require('readline');
let AWS = require('aws-sdk');
let s3 = new AWS.S3();

let MaxKb = parseInt(process.env.MaxObjectSize)*1000;

export function handler(event) {
    console.log("bucket: "+ process.env.Bucket)
    event.Records.map(record => {
        let bucket = record.s3.bucket.name;
        let key = record.s3.object.key;
        let sizeKb = record.s3.object.size;

        console.log(`${bucket} / ${key} / ${sizeKb}`);

        //Took 197870ms to do 9mb
        //23mb file has 21262 lines. 8000 lines per file should be fine
        if (sizeKb > MaxKb) {
            console.log("too big")
            splitFile(bucket, key)
        } else {
            console.log("not too big")
            copy(bucket, key)
        }
    })
}

function splitFile(sourceBucket: string, key: string) {
    let inputStream: Readable = s3.getObject({
        Bucket: sourceBucket,
        Key: key
    }).createReadStream();

    //We'll reassign a new stream to `outputStream` each time we hit MaxKb
    let fileNumber = 0;
    function createNewWriteStream() {
        let stream = fs.createWriteStream(`/tmp/${key}`);
        s3.putObject({
            Bucket: process.env.Bucket,
            Key: `${sourceBucket}/${key}_chunk-${fileNumber}`,
            Body: stream
        }, function(err, data) {
            if (err) console.log(err)
            else console.log(data)
        });

        return stream;
    }

    let outputStream = createNewWriteStream();

    //outputStream.on('open', function() {
        //console.log('outputStream open')
        let reader = readline.createInterface({
            input: inputStream
        });

        reader.on('line', function(line: string) {
            outputStream.write(line + '\n');

            if (outputStream.bytesWritten > MaxKb*1000) {
                console.log(`closing output stream at ${outputStream.bytesWritten}`);
                outputStream.close();

                outputStream = createNewWriteStream();
            }
        });
    //});
}

function copy(sourceBucket: string, key: string) {
    s3.copyObject({
        Bucket: process.env.Bucket,
        CopySource: `${sourceBucket}/${key}`,
        Key: key
    }, function(err, data) {
        if (err) console.log(err);
        if (data) console.log(data)
    })
}

function put(body, key: string) {
    s3.client.putObject({
        Bucket: process.env.Bucket,
        Key: key,
        Body: body
    }, function(resp) {
        console.log(resp)
    })
}
