# s3-chunking-lambda
An AWS Lambda that is triggered by s3 object creation events.

If the object is below the specified `MaxObjectSize`, copy it to the specified destination bucket.
If the object is above `MaxObjectSize`, split it into files of ~`MaxObjectSize` in the destination bucket.
The copied object keys are prefixed with the name of the source bucket. 

#### Running locally
Set environment variables `MaxObjectSize` (in mb) and `Bucket` (the destination bucket name).

Run: 
`yarn run local <source bucket> <object key> <file size in bytes>`
