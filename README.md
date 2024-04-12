# s3-chunking-lambda
An AWS Lambda that is triggered by s3 object creation events.

If the object is below the specified `MaxObjectSize`, copy it to the specified destination bucket.
If the object is above `MaxObjectSize`, split it into files of ~`MaxObjectSize` in the destination bucket.
The copied object keys are prefixed with the name of the source bucket. 

#### Running locally
Set environment variables `MaxObjectSize` (in mb) and `Bucket` (the destination bucket name).

Run: 
`yarn run local <source bucket> <object key> <file size in bytes>`

If you are not able to run and encounter issue related to config saying "Missing credentials in the config..."
Then please try using AWS profile before yarn:
`AWS_PROFILE=<aws-profile-name> yarn run local <source bucket> <object key> <file size in bytes>`

If you struggle with permission errors for your AWS profile for using S3 bucket and object in it.
then you can always try using "Dev Playground" AWS profile and create S3 bucket and test object in it 
like `AWS_PROFILE=developerPlayground yarn run local <source bucket> <object key> <file size in bytes>`

