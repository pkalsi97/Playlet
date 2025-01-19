import {S3Client} from '@aws-sdk/client-s3';
import {createPresignedPost} from '@aws-sdk/s3-presigned-post'

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

    public async generatePreSignedPost(userId:string,key:string):Promise<UploadServiceResponse> {
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
            fields: presignedPost.fields,
        };
    };
};
