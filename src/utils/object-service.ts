import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';

import {
    S3Client,
    GetObjectCommand,
    DeleteObjectCommand,
    GetObjectCommandOutput,
} from '@aws-sdk/client-s3'

import { Upload } from '@aws-sdk/lib-storage'

export class ObjectService{
    private s3Client: S3Client;
    private readonly region:string;
    private readonly bucket:string;

    constructor(region:string,bucket:string) {
        this.region = region;
        this.bucket = bucket;
        this.s3Client = new S3Client({region:this.region});
    }

    public async getObject(key:string):Promise<GetObjectCommandOutput["Body"]> {

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
    
        return (await this.s3Client.send(command)).Body;
    };

    public async uploadObject(object:fs.ReadStream,key:string):Promise<boolean> {

        const upload = new Upload({
            client: this.s3Client,
            params: {
                Bucket: this.bucket,
                Key: key,
                Body: object
            }
        });

        const result = await upload.done();
        return result.$metadata.httpStatusCode === 200;
    };

    public async deleteObject(key:string):Promise<boolean> { 
        
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key:key,
        });

        const response = await this.s3Client.send(command);
        if(!response.DeleteMarker) return false;

        return true;
    };

    public async writeToTemp(object:GetObjectCommandOutput["Body"],key:string):Promise<string> {

        const fileName: string = crypto.randomUUID();
        const filePath: string = path.join('/tmp',fileName);

        const writeStream = fs.createWriteStream(filePath);

        const bytes = await object!.transformToByteArray();
        const readable = Readable.from(bytes);
    
        await pipeline(readable, writeStream);
        return filePath;
    }

    public async getFromTemp(path:string):Promise<fs.ReadStream>{
        await fs.promises.access(path, fs.constants.R_OK);
        const readStream = fs.createReadStream(path);
        return readStream;
    };

    public async cleanUpFromTemp(path:string):Promise<boolean> {
        try {
            await fs.promises.access(path, fs.constants.F_OK);
            await fs.promises.unlink(path);
            return true
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT'){
                return true;
            }
            return false;
        }

    };
}
 