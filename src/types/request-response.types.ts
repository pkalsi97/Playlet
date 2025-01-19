export interface IResponse {
    success: boolean;
    message?: string;
    data?: any;
}

export interface IRequest {
    headers?: {
        authorization?: string;
        'x-access-token'?: string;
    };
    body?: {
        [key: string]: any;
    };
}