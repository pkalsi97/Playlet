import {
    S3Client,
} from '@aws-sdk/client-s3';

import {
    createPresignedPost
} from '@aws-sdk/s3-presigned-post'

import crypto from 'crypto';

export interface UploadServiceResponse{
    url: string;
    fields: any;
}

export class UploadService{
    private s3Client: S3Client;
    private readonly region: string;
    private readonly bucket: string;
    private readonly uploadSizeLimit: number;
    private readonly uploadTimeLimit: number;

    constructor(bucket:string,region:string,uploadSizeLimit:string,uploadTimeLimit:string){
        this.region = region;
        this.bucket = bucket;
        this.uploadSizeLimit = parseInt(uploadSizeLimit,10);
        this.uploadTimeLimit = parseInt(uploadTimeLimit,10);
        this.s3Client = new S3Client({region:this.region});
    }

    public async generatePreSignedPost(userId:string):Promise<UploadServiceResponse> {
        const key: string = this.generateKey(userId);

        const presignedPost = await createPresignedPost(this.s3Client,{
            Bucket: this.bucket,
            Key: key,
            Conditions: [
                ["content-length-range",1,this.uploadSizeLimit],
                ["eq", "$tagging", ""],
            ],
            Fields: {
                'tagging': 'upload=true'
            },
            Expires: this.uploadTimeLimit,
        });

        return {
            url:presignedPost.url,
            fields: presignedPost.fields,
        };
    };

    private generateKey(userId:string):string {
        const timestamp: number = Date.now();
        const uniqueId: string = crypto.randomUUID();
        const hash: string = crypto.createHash('sha256')
            .update(`${userId}-${timestamp}-${uniqueId}`)
            .digest('hex')
            .substring(0,32);
        
        // Format: userId/yyyy/mm/hash
        const date = new Date();
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth()+1).padStart(2,'0');

        return `${userId}/${year}/${month}/${hash}`;
    }

}
