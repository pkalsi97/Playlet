import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Context
} from 'aws-lambda';

import {
    UploadService,
    UploadServiceResponse
} from "../utils/upload-service"


const uploadService = new UploadService(
    process.env.TRANSPORTSTORAGE_BUCKET_NAME!,
    process.env.AWS_DEFAULT_REGION!,
    process.env.UPLOAD_SIZE_LIMIT!,
    process.env.UPLOAD_TIME_LIMIT!,
);

export const uploadHandler = async(event:APIGatewayProxyEvent,context:Context): Promise<APIGatewayProxyResult> =>{

    return {
        statusCode:200,
        body:JSON.stringify({
            success:false,
            body:{},
            error:{},
        }),
    };
}