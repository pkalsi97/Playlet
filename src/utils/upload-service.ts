import {
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';

import {
    createPresignedPost
} from '@aws-sdk/s3-presigned-post'

import crypto from 'crypto';

export interface UploadServiceResponse{
    url:string;
    key:string;
}

export class UploadService{
    private s3Client: S3Client;
    private readonly region: string;
    private readonly bucket: string;
    private readonly uploadSizeLimit: number;
    private readonly uploadTimeLimit: number;

    constructor(bucket:string,region:string,uploadSizeLimit:number,uploadTimeLimit:number){
        this.region = region;
        this.bucket = bucket;
        this.uploadSizeLimit = uploadSizeLimit;
        this.uploadTimeLimit = uploadTimeLimit;
        this.s3Client = new S3Client({region:this.region});
    }

    public async generatePreSignedPost(userId:string,filename:string,contentType:string):Promise<UploadServiceResponse> {
        const key: string = this.generateKey(userId,filename);
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType:contentType,
            ContentLength:50000,
            ServerSideEncryption:'AES256',
            Metadata:{
                userId,
                originalFilename:filename,
                uploadTimestamp:Date.now().toString(),

            }
        });

        const presignedPost = await createPresignedPost(this.s3Client,{
            Bucket: this.bucket,
            Key: key,
            Conditions: [
                ["content-length-range",1,this.uploadSizeLimit],
            ],
            Expires: this.uploadTimeLimit,
        });

        return {
            url:presignedPost.url,
            key:key,
        };
    };

    private generateKey(userId:string,filename:string):string {
        const timestamp: number = Date.now();
        const uniqueId: string = crypto.randomUUID();
        const hash: string = crypto.createHash('sha256')
            .update(`${userId}-${timestamp}-${uniqueId}`)
            .digest('hex')
            .substring(0,8);
        
        // Format: yyyy/mm/dd/userId/hash-uniqueId/filename
        const date = new Date();
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth()+1).padStart(2,'0');
        const day = String(date.getUTCDate()).padStart(2,'0');

        return `${year}/${month}/${day}/${userId}/${hash}-${uniqueId}/${filename}`;
    }

}
// we also need to give upload quota to every client so we can reject upload request if they have uploaded to much

// we can open a websocket, and do the following 1. upload requested 2. uploaded 3. upload validated 4. waiting for processing
//URL_GENERATED → UPLOADING (%) → UPLOAD_COMPLETE → VALIDATING → VALIDATED/FAILED
// we can get status of 1. client makes uplaod request , if accepted they get a presigned url , 2. when upload is complete 
// we are left with post upload validation , client can make a get request for sure .


