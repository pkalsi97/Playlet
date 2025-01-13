export enum Fault {
    CLIENT = 'Client',
    SERVER = 'Server',
};

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
        name: error?.['name'] || 'Internal Server Error',
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
    public statusCode: number;
    public fault: Fault;
    public retryable: boolean;

    constructor(
        message:string,
        statusCode:number,
        fault:Fault = Fault.SERVER,
        retryable:boolean,
    ){
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.fault = fault;
        this.retryable = retryable;
        Object.setPrototypeOf(this,new.target.prototype)
    };
};

export class ValidationError extends CustomError {
    constructor(
        message: string = "Validation Error",
        statusCode: number = 400,
        fault: Fault = Fault.CLIENT,
        retryable: boolean = true,
    ) {
        super(message, statusCode, fault, retryable);
    };
};


export class InternalServerError extends CustomError {
    constructor(
        message: string = "Internal Sever Error",
        statusCode: number = 500,
        fault: Fault = Fault.SERVER,
        retryable: boolean = false,
    ){
        super(message,statusCode,fault,retryable);
    };
};

export class BadRequestError extends CustomError {
    constructor(
        message: string = "Bad Request",
        statusCode: number = 400,
        fault: Fault = Fault.CLIENT,
        retryable: boolean = true,
    ){
        super(message,statusCode,fault,retryable);
    };
};

export class UploadServiceError extends CustomError {
    constructor(
        message: string = "Upload Service Error",
        statusCode: number = 503,
        fault: Fault = Fault.SERVER,
        retryable: boolean = false,
    ){
        super(message,statusCode,fault,retryable);
    };
};

export class ObjectServiceError extends CustomError {
    constructor(
        message: string = "Object Service Error",
        statusCode: number = 503,
        fault: Fault = Fault.SERVER,
        retryable: boolean = false,
    ){
        super(message,statusCode,fault,retryable);
    };
};

export class TranscodingServiceError extends CustomError {
    constructor(
        message: string = "Transcoding Service Error",
        statusCode: number = 503,
        fault: Fault = Fault.SERVER,
        retryable: boolean = false,
    ){
        super(message,statusCode,fault,retryable);
    };
};
