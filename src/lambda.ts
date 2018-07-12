let AWS = require('aws-sdk');
let s3 = new AWS.S3();

export function handler(event) {
    console.log("bucket: "+ process.env.Bucket)
    event.Records.map(record => {
        let bucket = record.s3.bucket.name;
        let key = record.s3.object.key;
        let size = record.s3.object.size;

        console.log(`${bucket} / ${key} / ${size}`);

        copy(bucket, key)

        //Took 197870ms to do 9mb
        //TODO - what is size unit?
        // if (size > 0) {
        // } else {
        // }
    })
}

// function get(bucket: string, ) {
//     s3.getObject({
//         Bucket:
//     })
// }

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