import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Context
} from 'aws-lambda';

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