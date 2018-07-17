import { handler } from './lambda';
let AWS = require('aws-sdk');

AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
AWS.config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
AWS.config.sessionToken = process.env.AWS_SESSION_TOKEN;
AWS.config.region = "eu-west-1";

async function run(event) {
    await handler(event)
}

run({
    Records: [
        {
            s3: {
                bucket: {
                    name: "gu-test-audio-logs"
                },
                object: {
                    key: "ls.s3.7a409d84-849d-4e01-80b1-935d492a79ab.2018-07-11T00.32.part0.txt",
                    size: 24223316
                }
            }
        }
    ]
});
