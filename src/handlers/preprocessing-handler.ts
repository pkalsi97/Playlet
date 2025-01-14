// import * as fs from 'fs';
// import ffmpeg from 'fluent-ffmpeg';
// import * as path from 'path';
// import { exec } from 'child_process';
// import { promisify } from 'util';

// import {
//     ObjectService
// } from '../utils/object-service';

// import {
//     MetadataExtractor,
//     ContentMetadata,
//     TechnicalMetadata,
//     QualityMetrics,
// } from '../utils/transcoding-services/content-metadata-service';

// import {
//     BasicValidationResult,
//     StreamValidationResult,
//     ContentValidationService
// } from '../utils/transcoding-services/content-validation-service';

// import {
//     GopCreator,
//     GopConfig,
//     GopResult,
//     GopSegment,
// } from '../utils/transcoding-services/gop-creation-service';

// import {
//     ObjectServiceError,
//     TranscodingServiceError,
//     InternalServerError,
//     exceptionHandlerFunction,
//     Fault
// } from '../utils/error-handling'

// if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
//     ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
//     ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
// }


// interface S3EventRecord {
//     eventVersion: string;
//     eventSource: string;
//     awsRegion: string;
//     eventTime: string;
//     eventName: string;
//     userIdentity: {
//         principalId: string;
//     };
//     requestParameters: {
//         sourceIPAddress: string;
//     };
//     responseElements: {
//         'x-amz-request-id': string;
//         'x-amz-id-2': string;
//     };
//     s3: {
//         s3SchemaVersion: string;
//         configurationId: string;
//         bucket: {
//             name: string;
//             ownerIdentity: {
//                 principalId: string;
//             };
//             arn: string;
//         };
//         object: {
//             key: string;
//             size: number;
//             eTag: string;
//             sequencer: string;
//         };
//     };
// }

// interface S3Event {
//     Records: S3EventRecord[];
// }
// interface SQSRecord {
//     messageId: string;
//     receiptHandle: string;
//     body: string;
//     attributes: {
//         ApproximateReceiveCount: string;
//         SentTimestamp: string;
//         SenderId: string;
//         ApproximateFirstReceiveTimestamp: string;
//     };
//     messageAttributes: Record<string, any>;
//     md5OfBody: string;
//     eventSource: string;
//     eventSourceARN: string;
//     awsRegion: string;
// }

// interface SQSEvent {
//     Records: SQSRecord[];
// }


// const objectService = new ObjectService(process.env.AWS_DEFAULT_REGION!,process.env.TRANSPORTSTORAGE_BUCKET_NAME!);
// const contentValidationService = new ContentValidationService(parseInt(process.env.UPLOAD_SIZE_LIMIT!,10));
// const metadataExtractor = new MetadataExtractor();


// export const preprocessingHandler = async(messages: SQSEvent): Promise<any> => {
//     // console.warn(messages);
//     try {
//         for (const message of messages.Records){
//             const s3Event: S3Event = JSON.parse(message.body);

//             for (const event of s3Event.Records){

//                 const key = event.s3.object.key;
//                 const object = await objectService.getObject(key);
//                 const path = await objectService.writeToTemp(object);

//                 console.warn(path);

//                 const basicValidationResult: BasicValidationResult = await contentValidationService.validateBasics(path);
//                 const streamValidationResult: StreamValidationResult = await contentValidationService.validateStreams(path);

//                 console.warn(basicValidationResult);
//                 console.warn(streamValidationResult);
//             };
//         };
//         return {
//             statusCode: 200,
//             body: 'Task Completed'
//         };
        
//     } catch (error) {
//         console.error('Error processing event:', error);
//         throw error;
//     }
// };

import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const EXPECTED_STRUCTURE = {
    'opt/ffmpeg': ['ffmpeg', 'ffprobe'],
    'opt/nodejs/node_modules': ['fluent-ffmpeg']
};

const possiblePaths = [
    '/opt/ffmpeg',
    '/opt/nodejs',
    '/var/task/ffmpeg',
    '/var/runtime/ffmpeg',
    '/var/lang/ffmpeg',
    '/opt',
    '/var/task',
    '/var/runtime'
];

const ffmpegPaths = [
    '/opt/ffmpeg/ffmpeg',
    '/var/task/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    '/opt/ffmpeg/ffprobe',
    '/var/task/ffprobe',
    '/usr/local/bin/ffprobe',
    '/usr/bin/ffprobe'
];

const execAsync = promisify(exec);  

function validateLayerStructure(basePath: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    let valid = true;

    for (const [dir, expectedFiles] of Object.entries(EXPECTED_STRUCTURE)) {
        const fullPath = path.join(basePath, dir);
        
        try {
            if (!fs.existsSync(fullPath)) {
                issues.push(`Directory ${dir} does not exist`);
                valid = false;
                continue;
            }

            const contents = fs.readdirSync(fullPath);
            for (const file of expectedFiles) {
                if (!contents.includes(file)) {
                    issues.push(`Missing ${file} in ${dir}`);
                    valid = false;
                }
            }
        } catch (err) {
            issues.push(`Error checking ${dir}: ${err}`);
            valid = false;
        }
    }

    return { valid, issues };
}



export const preprocessingHandler = async(messages: any): Promise<any> => {
    try {
        console.warn('=== Layer Testing Started ===');

        console.warn('\nEnvironment Variables:');
        console.warn({
            AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
            AWS_LAMBDA_FUNCTION_VERSION: process.env.AWS_LAMBDA_FUNCTION_VERSION,
            AWS_LAMBDA_FUNCTION_MEMORY_SIZE: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
            LAMBDA_TASK_ROOT: process.env.LAMBDA_TASK_ROOT,
            LAMBDA_RUNTIME_DIR: process.env.LAMBDA_RUNTIME_DIR
        });
        console.warn('\nChecking all possible paths:');
        possiblePaths.forEach(p => {
            console.warn(`${p}:`, {
                exists: fs.existsSync(p),
                isDirectory: fs.existsSync(p) ? fs.statSync(p).isDirectory() : false,
                contents: fs.existsSync(p) && fs.statSync(p).isDirectory() ? fs.readdirSync(p) : 'N/A',
                permissions: fs.existsSync(p) ? fs.statSync(p).mode : 'N/A'
            });
        });


        console.warn('\nRoot Directory Analysis:');
        const rootContents = fs.readdirSync('/');
        console.warn('Root contents:', rootContents);
        rootContents.forEach(item => {
            const fullPath = path.join('/', item);
            try {
                const stats = fs.statSync(fullPath);
                console.warn(`${item}:`, {
                    type: stats.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    permissions: stats.mode
                });
            } catch (err) {
                console.warn(`Error checking ${item}:`, err);
            }
        });

        console.warn('\nFluent-FFmpeg Check:');
        const fluentPaths = [
            'fluent-ffmpeg/package.json',
            '/opt/nodejs/node_modules/fluent-ffmpeg/package.json',
            path.join(process.env.LAMBDA_TASK_ROOT!, 'node_modules/fluent-ffmpeg/package.json')
        ];

        fluentPaths.forEach(p => {
            try {
                const pkg = require(p);
                console.warn(`Found fluent-ffmpeg at ${p}:`, pkg.version);
            } catch (err) {
                console.warn(`Not found at ${p}`);
            }
        });


        console.warn('\nFFmpeg Binary Check:');
        for (const ffmpegPath of ffmpegPaths) {
            try {
                if (fs.existsSync(ffmpegPath)) {
                    const stats = fs.statSync(ffmpegPath);
                    console.warn(`${ffmpegPath}:`, {
                        size: stats.size,
                        permissions: stats.mode,
                        executable: (stats.mode & fs.constants.X_OK) !== 0
                    });

                    const { stdout } = await execAsync(`${ffmpegPath} -version`);
                    console.warn('Version info:', stdout.split('\n')[0]);
                }
            } catch (err) {
                console.warn(`Error with ${ffmpegPath}:`, err);
            }
        }

        console.warn('\nLayer Structure Validation:');
        const validation = validateLayerStructure('/');
        console.warn('Validation result:', validation);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Layer Testing Completed',
                environment: {
                    taskRoot: process.env.LAMBDA_TASK_ROOT,
                    runtimeDir: process.env.LAMBDA_RUNTIME_DIR,
                    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
                    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
                    memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
                },
                paths: {
                    checked: possiblePaths,
                    existing: possiblePaths.filter(p => fs.existsSync(p))
                },
                validation,
                timestamp: new Date().toISOString()
            }, null, 2)
        };
    } catch (error) {
        console.error('Error in layer testing:', error);
        throw error;
    }
};