export enum Fault {
    CLIENT = 'Client',
    SERVER = 'Server',
}

export enum ErrorName {
    AWS_ERROR = 'AWSError',
    INTERNAL_ERROR = 'InternalServerError',
    TRANSCODING_ERROR = 'TranscodingError',
    VALIDATION_ERROR = 'ValidationError',
    BAD_REQUEST_ERROR = 'BadRequestError',
    UPLOAD_SERVICE_ERROR = 'UploadServiceError',
    OBJECT_SERVICE_ERROR = 'ObjectServiceError',
    PREPROCESSING_ERROR = 'PreprocessingError',
}

interface IErrorLog {
    name: string;
    message: string;
    statusCode: number;
    fault: Fault;
    retryable: boolean;
    attempts: number;
    cfId: string;
    extendedRequestId: string;
    requestId: string;
    totalRetryDelay: number;
    stack: string;
    timestamp:number;
}

interface IErrorMetadata {
    name: string;
    fault: Fault;
    retryable: boolean;
    timestamp: number;
}

interface IClientResponse {
    statusCode: number;
    message: string;
    metadata: IErrorMetadata;
}

export const exceptionHandlerFunction = (error:any): IClientResponse => {

    const errorLog:IErrorLog = {
        name: error?.['name'] || ErrorName.INTERNAL_ERROR,
        message: error?.['message'] || 'An unknown error occurred',
        statusCode: error?.['$response']?.statusCode || 500,
        fault: error?.['$fault'] || Fault.SERVER,
        retryable: error?.['$retryable'] || false,
        attempts: error?.['$metadata']?.attempts || 0,
        cfId: error?.['$metadata']?.cfId || 'N/A',
        extendedRequestId: error?.['$metadata']?.extendedRequestId || 'N/A',
        requestId: error?.['$metadata']?.requestId || 'N/A',
        totalRetryDelay: error?.['$metadata']?.totalRetryDelay || 0,
        stack: error?.['stack'] || 'No stack trace available',
        timestamp:Date.now(), 
    };

    if(error instanceof CustomError){
        errorLog.statusCode = error.statusCode;
        errorLog.name = error.name;
        errorLog.message = error.message;
        errorLog.fault = error.fault;
        errorLog.retryable = error.retryable;
    }


    console.error(errorLog);

    const clientResponse:IClientResponse = {
        statusCode: errorLog.statusCode,
        message:errorLog.message,
        metadata: {
            name:errorLog.name,
            fault:errorLog.fault,
            retryable:errorLog.retryable,
            timestamp:errorLog.timestamp,
        }
    };

    return clientResponse;
}

export class CustomError extends Error {
    public name: ErrorName;
    public statusCode: number;
    public fault: Fault;
    public retryable: boolean;

    constructor(
        name: ErrorName,
        message: string = "Unknown Error!",
        statusCode: number,
        fault: Fault = Fault.SERVER,
        retryable: boolean,
    ){
        super(message);
        this.name = name;
        this.statusCode = statusCode;
        this.fault = fault;
        this.retryable = retryable;
        Object.setPrototypeOf(this, new.target.prototype);
    };
}