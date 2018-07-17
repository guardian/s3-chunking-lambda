import {Duplex, Readable} from "stream";
import {ReadStream, WriteStream} from "fs";
import {ReadLine} from "readline";

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

function promiseLoop(f: (v: any) => Promise<any>): (v: any) => Promise<any> {
    return function loop(value) {
        return f(value)
            .then(next => {
                return loop(next)
            }, end => {
                return end
            })
    }
}

/**
 * Problem - we begin streaming from the local file when it's empty, it probably doesn't pick up updates.
 * Probably cannot change a stream part way through when we need to output to a new file.
 *
 * Solution -
 * Stream to a series of local files using readlines.
 * As a file is completed, start streaming it to s3.
 *
 * - create WriteStream (local state)
 * - on line, write to file.
 *   if maxKb, end WriteStream and create a new one. Create reader for file and pipe to s3
 */

class State {
    //We'll reassign a new stream to `outputStream` each time we hit MaxKb
    fileNumber: number = 0;
    reader: ReadLine;
    outputStream: WriteStream;

    /**
     * ReadLine.pause() does not immediately pause 'line' events,
     * so buffer them for the next stream to avoid writing to a closed stream.
     */
    paused: boolean = false;
    pausedBuffer: Array<string> = [];

    constructor(inputStream: Readable) {
        this.reader = readline.createInterface({
            input: inputStream
        });
    }
}

function splitFile(sourceBucket: string, key: string) {
    function createNewWriteStream(state: State): Promise<State> {
        console.log("createNewWriteStream")
        //TODO - can we avoid buffering on disk for s3? - https://github.com/aws/aws-sdk-js/issues/94
        state.outputStream = fs.createWriteStream(`/tmp/${key}_chunk-${state.fileNumber}`);
        return new Promise((resolve, reject) => {
            state.outputStream.on('open', () => {
                resolve(state)
            })
        });
    }

    function pipeToS3(state: State): Promise<State> {
        console.log("pipeToS3")

        let readStream = fs.createReadStream(`/tmp/${key}_chunk-${state.fileNumber}`);
        state.outputStream.on('close', () => {
            console.log("closing readStream")
            readStream.close()
        });

        return s3.upload({
            Bucket: process.env.Bucket,
            Key: `${sourceBucket}/${key}_chunk-${state.fileNumber}`,
            Body: readStream
        }).promise().then((response) => {
            return state;
        })
    }

    function readLines (state: State): Promise<State> {
        return new Promise((resolve, reject) => {
            console.log("readLines")
            state.paused = false;

            state.reader.on('line', (line: string) => {
                if (state.paused) state.pausedBuffer.push(line + '\n');
                else {
                    state.outputStream.write(line + '\n');

                    if (state.outputStream.bytesWritten > MaxKb*1000) {
                        console.log(`pausing readline at ${state.outputStream.bytesWritten}`);
                        state.reader.pause();
                        state.paused = true;
                    }
                }

                //TODO - remove
                if (state.fileNumber > 10) state.reader.close();
            });

            state.reader.on('pause', () => {
                console.log(`paused at ${state.fileNumber}`)
                state.outputStream.end();
                state.fileNumber++;

                //Create a new file stream before resuming
                return createNewWriteStream(state)
                    .then(pipeToS3)
                    .then((state) => {
                        console.log(`resuming at ${state.fileNumber} with pausedBuffer of ${state.pausedBuffer.length}`)
                        state.pausedBuffer.forEach(line => state.outputStream.write(line));
                        state.pausedBuffer = [];

                        state.reader.resume();
                        return state;
                    })
            });

            state.reader.on('close', () => {
                console.log("closed")
                state.outputStream.end();
                reject(state)
            });
        });
    }

    let inputStream: Readable = s3.getObject({
        Bucket: sourceBucket,
        Key: key
    }).createReadStream();

    createNewWriteStream(new State(inputStream))
        .then(pipeToS3)
        .then(state => promiseLoop(readLines)(state))
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
