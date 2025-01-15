import ffmpeg from 'fluent-ffmpeg';

import path from 'path';

import {
    GopConfig,
    GopResult,
    GopSegment,
    GopStatus,
} from '../types/gop.types'

import { ObjectService } from '../services/storage/object-service';
import { MetadataExtractor } from '../services/transcoding/content-metadata-service';
import { ContentValidationService } from '../services/transcoding/content-validation-service';
import { GopCreator, } from '../services/transcoding/gop-creation-service';

import {
    ErrorName,
    CustomError,
    exceptionHandlerFunction,
    Fault
} from '../utils/error-handling'


interface S3EventRecord {
    eventVersion: string;
    eventSource: string;
    awsRegion: string;
    eventTime: string;
    eventName: string;
    userIdentity: {
        principalId: string;
    };
    requestParameters: {
        sourceIPAddress: string;
    };
    responseElements: {
        'x-amz-request-id': string;
        'x-amz-id-2': string;
    };
    s3: {
        s3SchemaVersion: string;
        configurationId: string;
        bucket: {
            name: string;
            ownerIdentity: {
                principalId: string;
            };
            arn: string;
        };
        object: {
            key: string;
            size: number;
            eTag: string;
            sequencer: string;
        };
    };
}

interface S3Event {
    Records: S3EventRecord[];
}
interface SQSRecord {
    messageId: string;
    receiptHandle: string;
    body: string;
    attributes: {
        ApproximateReceiveCount: string;
        SentTimestamp: string;
        SenderId: string;
        ApproximateFirstReceiveTimestamp: string;
    };
    messageAttributes: Record<string, any>;
    md5OfBody: string;
    eventSource: string;
    eventSourceARN: string;
    awsRegion: string;
}

interface SQSEvent {
    Records: SQSRecord[];
}


if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}

const contentValidationService = new ContentValidationService();
const metadataExtractor = new MetadataExtractor();
const transportObjectService = new ObjectService(process.env.AWS_DEFAULT_REGION!,process.env.TRANSPORTSTORAGE_BUCKET_NAME!);
const assetObjectService = new ObjectService(process.env.AWS_DEFAULT_REGION!,process.env.CONTENTSTORAGE_BUCKET_NAME!);

const gopConfig:GopConfig = {
    keyframeInterval:2,
    forceClosedGop:true,
    sceneChangeDetection:true,
    outputDir:'/tmp/gops',
    frameRate:30,
};

const gopCreator = new GopCreator(gopConfig);

const initSourceContentFunc = async(key:string):Promise<string> => {

    const object = await transportObjectService.getObject(key);
    if (!object){
        throw new CustomError(ErrorName.OBJECT_SERVICE_ERROR,"Unable to get object from Object Storage",503,Fault.SERVER,true);
    }

    const path = await transportObjectService.writeToTemp(object);
    if (!path) {
        throw new CustomError(ErrorName.OBJECT_SERVICE_ERROR,"Unable to store object in tmp",503,Fault.SERVER,true);
    }

    return path;
};


const processGopsFunc = async(key:string,filepath:string):Promise<GopResult> => {
    const startTime = Date.now();
    // userId/yyyy/mm/hash
    const parts = key.split('/');
    if (parts.length !== 4){
        throw new CustomError (ErrorName.PREPROCESSING_ERROR, "Invalid Key Format",503,Fault.SERVER,false);
    }

    const gopCreationResponse : GopResult = await gopCreator.createGopSegments(filepath);
                
    if(!gopCreationResponse || !gopCreationResponse.success){
        throw new CustomError(ErrorName.PREPROCESSING_ERROR,"Failed to create Gops",503,Fault.SERVER,true);
    }

    const userId: string = parts[0];
    const assetId: string = parts[3]; 

    const finalGopSegments: GopSegment[] = [];

    await Promise.all(
        gopCreationResponse.segments.map(async (segment)=>{
            const object = await transportObjectService.getFromTemp(segment.path);
            if(!object){
                throw new CustomError(
                    ErrorName.PREPROCESSING_ERROR,
                    `Unable to Fetch gop from tmp: ${segment.path}`,
                    503,
                    Fault.SERVER,
                    false
                );
            }

            const fileName = path.basename(segment.path);
            const gopKey = `${userId}/${assetId}/${fileName}`;

            const uploadGop = await assetObjectService.uploadObject(object, gopKey);
            if (!uploadGop) {
                throw new CustomError(
                    ErrorName.OBJECT_SERVICE_ERROR,
                    `Unable to store gop in Asset Storage: ${gopKey}`,
                    503,
                    Fault.SERVER,
                    false
                );
            }

            const finalSegment:GopSegment = {
                sequence:segment.sequence,
                path: gopKey,
                status:GopStatus.UPLOADED,
            };
            finalGopSegments.push(finalSegment);
        })
    );

    const totalUploadTime = Date.now() - startTime;

    return {
        success:true,
        timeTaken:gopCreationResponse.timeTaken + totalUploadTime,
        segments:finalGopSegments.sort((a, b) => a.sequence - b.sequence),
    }
};


export const preprocessingHandler = async(messages: SQSEvent): Promise<any> => {

    try{
        for (const message of messages.Records){
            const s3Events:S3Event = JSON.parse(message.body);

            for (const event of s3Events.Records){
                // Get the source object and store it in tmp
                const key: string = event.s3.object.key;
                const filePath: string = await initSourceContentFunc(key);

                // Run FFprobe Validations on source
                const [basicValidation, streamValidation] = await Promise.all([
                    contentValidationService.validateBasics(filePath),
                    contentValidationService.validateStreams(filePath)
                ]);

                if (!basicValidation.isValid || !streamValidation.isPlayable || streamValidation.error){
                    throw new CustomError (ErrorName.VALIDATION_ERROR,"Provided Content is not Valid",400,Fault.CLIENT,true);
                }

                // extract useful metadata from the source
                const [technicalMetadata,qualityMetrics,contentMetadata] = await Promise.all([
                    metadataExtractor.extractTechnicalMetadata(filePath),
                    metadataExtractor.extractQualityMetrics(filePath),
                    metadataExtractor.extractContentMetadata(filePath)
                ]);

                // Gop Creations & Storage in Content Storage
                const finalGopOutput = await processGopsFunc(key,filePath);
            }
        }

        return{
            statusCode:200,
            message: "Success",
        }

    } catch(error){
        console.warn(error);
        return {
            statusCode:503,
            message: "Failure",
        }
    }
};


// - ValidationErrors (Client)
//   - Format Issues
//   - Codec Issues
//   - Size Issues
//   - Missing Streams

// - ProcessingErrors (Server)
//   - GOP Creation Failed
//   - Transcoding Failed
//   - Resource Exhaustion
//   - Memory Issues

// - StorageErrors
//   - S3 Access
//   - Temp Storage
//   - Permission Issues

// - SystemErrors
//   - FFmpeg Failures
//   - Binary Issues
//   - Environment Issues


// non retryable

//   - Invalid Format
// - Unsupported Codec
// - Missing Required Streams
// - File Too Large
// - Corrupt File

//Retryable (3 attempts):
// - S3 Timeouts
// - FFmpeg Temporary Failures
// - Resource Constraints
// - System Load Issues