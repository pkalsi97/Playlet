import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Context
} from 'aws-lambda';

import {
    Fault,
    InternalServerError,
    ValidationError,
    UploadServiceError,
    exceptionHandlerFunction
} from '../utils/error-handling'

import {
    IRequest,
    IResponse
} from '../utils/request-response'

import {
    ValidationField,
    ValidationResponse,
    ValidationService
} from '../utils/validation-service'

import {
    UploadService,
    UploadServiceResponse
} from "../utils/upload-service"

import {
    AuthService
} from "../utils/auth-service"


const uploadService = new UploadService(
    process.env.TRANSPORTSTORAGE_BUCKET_NAME!,
    process.env.AWS_DEFAULT_REGION!,
    process.env.UPLOAD_SIZE_LIMIT!,
    process.env.UPLOAD_TIME_LIMIT!,
);

const authService = new AuthService(
    process.env.USER_POOL_ID!,
    process.env.CLIENT_ID!,
    process.env.AWS_DEFAULT_REGION!
);

const uploadRequestFunc = async (request:IRequest):Promise<IResponse> => {
    const validationResult:ValidationResponse = ValidationService.validate(request,[
        ValidationField.REQUEST_HEADERS,
        ValidationField.ACCESS_TOKEN,
    ]);

    if (!validationResult.success){
        throw new ValidationError (validationResult.message,Fault.CLIENT,true);
    }

    const token = request.headers?.['x-access-token'];
    const accessToken = token?.slice(7)!;
    const userId = await authService.getUser(accessToken);

    const uploadServiceResponse = await uploadService.generatePreSignedPost(userId);
    if (!uploadServiceResponse){
        throw new UploadServiceError("Upload Service is down!",Fault.SERVER,true);
    }

    return {
        success:true,
        message: "Upload url successfully generated!",
        data:uploadServiceResponse,
    }
}


const executionFunctionMap: Record<string, (request: IRequest) => Promise<IResponse>> = {
    '/v1/user/upload-request': uploadRequestFunc,
};

export const uploadHandler = async(event:APIGatewayProxyEvent,context:Context): Promise<APIGatewayProxyResult> =>{
    try{    
        const path = event.path;
        const executionFunction = executionFunctionMap[path];
        if (!executionFunction) {
            throw new InternalServerError(`No Function Mapping Found For ${path}`,Fault.CLIENT,true);
        }

        const request : IRequest = {
            headers:{
                ...(event.headers.Authorization || event.headers.authorization) && {
                    authorization: event.headers.Authorization || event.headers.authorization
                },
                ...(event.headers['X-Access-Token'] || event.headers['x-access-token']) && {
                    'x-access-token': event.headers['X-Access-Token'] || event.headers['x-access-token']
                }
            },
            body: event.body ? JSON.parse(event.body) : undefined
        };

        const response = await executionFunction(request);

        return {
            statusCode:200,
            body: JSON.stringify(response)
        };

    } catch (error){
        const errorResponse = exceptionHandlerFunction(error);
        return {
            statusCode:errorResponse.statusCode,
            body:JSON.stringify({
                success:false,
                message:errorResponse.message,
                body:{},
                error:errorResponse.metadata,
            }),
        };
    }
}