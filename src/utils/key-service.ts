import { CustomError, ErrorName, Fault} from '../utils/error-handling';
import crypto from 'crypto';


// make a key service ultimately
export interface KeyOwner {
    userId: string;
    assetId: string;
}

export const getOwner = (key: string): KeyOwner => {
    const parts = key.split('/');
    if (parts.length < 2) {
        throw new CustomError(
            ErrorName.PREPROCESSING_ERROR, 
            "Invalid Key Format",
            400,
            Fault.CLIENT, 
            false
        );
    }

    const userId = parts[0];
    const assetId = parts[1];

    return { userId, assetId };
}

export const getUploadKey = (userId:string):string=>{
    const timestamp: number = Date.now();
    const uniqueId: string = crypto.randomUUID();
    const hash: string = crypto.createHash('sha256')
        .update('${userId}-${timestamp}-${uniqueId}')
        .digest('hex')
        .substring(0,32);

    return '${userId}/${hash}';
}

// -> upload key - userId/assetId


