import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

import { 
    SQSEvent,
    S3Event,
} from 'aws-lambda';


import {
    ErrorName,
    CustomError,
    exceptionHandlerFunction,
    Fault,
} from '../utils/error-handling';

import { SourceMetadata } from '../types/metadata.types';
import { ObjectService } from '../services/storage/object-service';
import { MetadataExtractor } from '../services/transcoding/content-metadata-service';
import { ContentValidationService } from '../services/transcoding/content-validation-service';
import { TaskCreator } from '../utils/task-creator';

import { 
    TaskType,
    WorkerType,
    Task,
    Location,
} from '../types/task.types';

import { 
    MetadataCache,
    MetadataPath,
    ProcessingStage
} from '../services/storage/metadata-storage-service';

import { 
    SQSClient,
    SendMessageCommand,
 } from '@aws-sdk/client-sqs';


interface PreprocessingResult{
    userId:string;
    assetId:string;
    metadata:SourceMetadata,
}

interface PreprocessingResults{
    Records:PreprocessingResult[];
}

interface KeyOwner {
    userId: string;
    assetId: string;
}

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}


const contentValidationService = new ContentValidationService();
const metadataExtractor = new MetadataExtractor();
const transportObjectService = new ObjectService(process.env.AWS_DEFAULT_REGION!,process.env.TRANSPORTSTORAGE_BUCKET_NAME!);
const metadataCache = new MetadataCache(process.env.METADATASTORAGE_TABLE_NAME!,process.env.AWS_DEFAULT_REGION!);
const sqs = new SQSClient({region:process.env.AWS_DEFAULT_REGION!});


const initSourceContentFunc = async(key:string):Promise<string> => {
    const object = await transportObjectService.getObject(key);
    if (!object){
        throw new CustomError(ErrorName.OBJECT_SERVICE_ERROR,"Unable to get object from Object Storage",503,Fault.SERVER,true);
    }

    const filePath = await transportObjectService.writeToTemp(object);
    if (!path) {
        throw new CustomError(ErrorName.OBJECT_SERVICE_ERROR,"Unable to store object in tmp",503,Fault.SERVER,true);
    }
    return filePath;
};

const getOwner = (key: string): KeyOwner => {
    // userId/yyyy/mm/hash
    const parts = key.split('/');
    if (parts.length !== 4) {
        throw new CustomError(
            ErrorName.PREPROCESSING_ERROR, 
            "Invalid Key Format",
            400,
            Fault.CLIENT, 
            false
        );
    }

    const userId = parts[0];
    const assetId = parts[3];

    return { userId, assetId };
};


export const preprocessingHandler = async(messages: SQSEvent): Promise<any> => {

    const preprocessingResults:PreprocessingResults = {
        Records:[],
    }

    try{
        for (const message of messages.Records){
            const s3Events:S3Event = JSON.parse(message.body);

            for (const event of s3Events.Records){
                // Get the source object and store it in tmp
                const key: string = event.s3.object.key;
                const bucket: string = event.s3.bucket.name;
                const filePath: string = await initSourceContentFunc(key);

                const owner:KeyOwner = getOwner(key);
                const userId = owner.userId;
                const assetId = owner.assetId;

                // Run FFprobe Validations on source
                const [basicValidation, streamValidation] = await Promise.all([
                    contentValidationService.validateBasics(filePath),
                    contentValidationService.validateStreams(filePath)
                ]);

                if (!basicValidation.isValid || !streamValidation.isPlayable || streamValidation.error){
                    throw new CustomError (
                        ErrorName.VALIDATION_ERROR,
                        "Provided Content is not Valid",
                        400,
                        Fault.CLIENT,
                        true
                    );
                }
                            
    
                await metadataCache.InitializeRecord(userId,assetId);
                await metadataCache.updateProgress(userId, assetId, ProcessingStage.UPLOAD);
                await metadataCache.updateProgress(userId, assetId, ProcessingStage.VALIDATION);

                // extract useful metadata from the source
                const [technicalMetadata,qualityMetrics,contentMetadata] = await Promise.all([
                    metadataExtractor.extractTechnicalMetadata(filePath),
                    metadataExtractor.extractQualityMetrics(filePath),
                    metadataExtractor.extractContentMetadata(filePath)
                ]);

                await metadataCache.updateProgress(userId, assetId, ProcessingStage.METADATA);

                const sourceMetadata:SourceMetadata ={
                    validation:{
                        basic:basicValidation,
                        stream:streamValidation
                    },
                    metadata:{
                        technical:technicalMetadata,
                        quality:qualityMetrics,
                        content:contentMetadata,
                    }
                };
 
                const preprocessingResult:PreprocessingResult = {
                    userId:owner.userId,
                    assetId:owner.assetId,
                    metadata:sourceMetadata,
                }
                preprocessingResults.Records.push(preprocessingResult);
                // update in metadata cache
                await metadataCache.updateMetadata(userId,assetId,MetadataPath.VALIDATION_BASIC,basicValidation);
                await metadataCache.updateMetadata(userId,assetId,MetadataPath.VALIDATION_STREAM,streamValidation);
                await metadataCache.updateMetadata(userId,assetId,MetadataPath.METADATA_TECHNICAL,technicalMetadata);
                await metadataCache.updateMetadata(userId,assetId,MetadataPath.METADATA_QUALITY,qualityMetrics);
                await metadataCache.updateMetadata(userId,assetId,MetadataPath.METADATA_CONTENT,contentMetadata);
                // clean up
                await transportObjectService.cleanUpFromTemp(filePath);

                // Task Creation
                const input: Location = {
                    Bucket: bucket,
                    Key: key,
                }

                const output: Location = {
                    Bucket: process.env.CONTENTSTORAGE_BUCKET_NAME!,
                    Key: `${userId}/${assetId}/gops`
                }

  
                const task = TaskCreator.createTask(userId,assetId,input,output,TaskType.GOP_CREATION,WorkerType.GOP_WORKER,sourceMetadata);

                const sendMessageCommand = new SendMessageCommand({
                    QueueUrl: process.env.MEDIASEGMENTERQUEUE_QUEUE_URL!,
                    MessageBody: JSON.stringify({
                        task
                    })        
                });

                const response = await sqs.send(sendMessageCommand);
                if(!response || response.$metadata.httpStatusCode !== 200){
                    throw new CustomError(
                        ErrorName.INTERNAL_ERROR,
                        "Unable to send message to queue",
                        503,
                        Fault.SERVER,
                        true
                    );
                }
            }
        }

        return{
            statusCode:200,
            message: "Validation Successful",
        }
    } catch(error){
        const errorResponse = exceptionHandlerFunction(error);
        if (error instanceof CustomError && error.name === ErrorName.VALIDATION_ERROR  && error.fault === Fault.CLIENT) {   
            return {
                statusCode: 200,
                message: "Failed but processed",    
                error: errorResponse
            };
        }
    }
};


