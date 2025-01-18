import { CustomError, ErrorName, Fault} from './error-handling';


// make a key service ultimately
export interface KeyOwner {
    userId: string;
    assetId: string;
}

export const getOwner = (key: string): KeyOwner => {
    // userId/yyyy/mm/hash
    const parts = key.split('/');
    if (parts.length !== 4) {
        throw new CustomError(
            ErrorName.PREPROCESSING_ERROR, 
            "Invalid Key Format",
            400,
            Fault.CLIENT, 
            false
        );
    }

    const userId = parts[0];
    const assetId = parts[3];

    return { userId, assetId };
}; 