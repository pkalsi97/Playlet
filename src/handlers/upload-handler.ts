import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Context
} from 'aws-lambda'

import {
    Fault,
    CustomError,
    ErrorName,
    exceptionHandlerFunction
} from '../utils/error-handling'

import {
    IRequest,
    IResponse
} from '../types/request-response.types'

import {
    ValidationField,
    ValidationResponse,
    ValidationService
} from '../services/auth/validation-service'

import { getUploadKey } from '../utils/key-service'
import { UploadService } from "../services/storage/upload-service"
import { AuthService } from "../services/auth/auth-service"


const uploadService = new UploadService(
    process.env.TRANSPORTSTORAGE_BUCKET_NAME!,
    process.env.AWS_DEFAULT_REGION!,
    process.env.UPLOAD_SIZE_LIMIT!,
    process.env.UPLOAD_TIME_LIMIT!,
)

const authService = new AuthService(
    process.env.USER_POOL_ID!,
    process.env.CLIENT_ID!,
    process.env.AWS_DEFAULT_REGION!
)

const uploadRequestFunc = async (request:IRequest):Promise<IResponse> => {
    const validationResult:ValidationResponse = ValidationService.validate(request,[
        ValidationField.REQUEST_HEADERS,
        ValidationField.ACCESS_TOKEN,
    ]);

    if (!validationResult.success){
        throw new CustomError (ErrorName.VALIDATION_ERROR,validationResult.message,400,Fault.CLIENT,true);
    }

    const token = request.headers?.['x-access-token'];
    const accessToken = token?.slice(7)!;
    const userId = await authService.getUser(accessToken);
    const key = getUploadKey(userId);

    const uploadServiceResponse = await uploadService.generatePreSignedPost(userId,key);
    if (!uploadServiceResponse){
        throw new CustomError(ErrorName.UPLOAD_SERVICE_ERROR,"Upload Service is down!",503,Fault.SERVER,true);
    }

    return {
        success:true,
        message: "Upload url successfully generated!",
        data:uploadServiceResponse,
    }
}


const executionFunctionMap: Record<string, (request: IRequest) => Promise<IResponse>> = {
    '/v1/user/upload-request': uploadRequestFunc,
}

export const uploadHandler = async(event:APIGatewayProxyEvent,context:Context): Promise<APIGatewayProxyResult> =>{
    try{    
        const path = event.path;
        const executionFunction = executionFunctionMap[path];
        if (!executionFunction) {
            throw new CustomError(ErrorName.INTERNAL_ERROR,`No Function Mapping Found For ${path}`,404,Fault.CLIENT,true)
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
        }

    } catch (error){
        const errorResponse = exceptionHandlerFunction(error)
        return {
            statusCode:errorResponse.statusCode,
            body:JSON.stringify({
                success:false,
                message:errorResponse.message,
                body:{},
                error:errorResponse.metadata,
            }),
        }
    }
}