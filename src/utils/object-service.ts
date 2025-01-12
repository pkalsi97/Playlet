import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';

import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommandOutput,
} from '@aws-sdk/client-s3'


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

    public async putObject(object:ReadableStream,key:string):Promise<boolean> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: object,
        });

        const response = await this.s3Client.send(command);
        return response.$metadata.httpStatusCode === 200;
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

        const readableStream = object!.transformToWebStream();
        const writeStream = fs.createWriteStream(filePath);
        const nodeReadable = Readable.fromWeb(readableStream as WebReadableStream);

        await pipeline(nodeReadable, writeStream);
        return filePath;
    }

    public async getFromTemp(path:string):Promise<ReadableStream>{

        await fs.promises.access(path, fs.constants.R_OK);
        const readStream = fs.createReadStream(path);

        return Readable.toWeb(readStream) as ReadableStream;
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
 