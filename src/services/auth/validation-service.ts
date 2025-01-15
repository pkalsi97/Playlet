// src/utils/validators/types.ts
import { IRequest } from '../../types/request-response.types'

export enum ValidationField {
    REQUEST_BODY = 'REQUEST_BODY',
    EMAIL = 'EMAIL',
    PASSWORD = 'PASSWORD',
    REQUEST_HEADERS = 'REQUEST_HEADERS',
    REFRESH_TOKEN = 'REFRESH_TOKEN',
    ACCESS_TOKEN = 'ACCESS_TOKEN',
    OTP = 'OTP'
}

interface ValidationRule {
    validate: (value: any) => boolean;
    message: string;
}

export interface ValidationResponse {
    success: boolean;
    message?: string;
}

const ValidationRules: Record<ValidationField, ValidationRule> = {
    [ValidationField.REQUEST_BODY]: {
        validate: (value: any) => value !== undefined && value !== null,
        message: 'Request body is required'
    },

    [ValidationField.REQUEST_HEADERS]: {
        validate: (value: any) => value !== undefined && value !==null,
        message: 'Headers are missing'
    },

    [ValidationField.EMAIL]: {
        validate: (email: string) => {
            if (!email) return false;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },
        message: 'Invalid email format'
    },

    [ValidationField.PASSWORD]: {
        validate: (password: string) => {
            if (!password || password.trim().length === 0) return false;
            return true;
        },
        message: 'Password is required'
    },

    [ValidationField.OTP]: {
        validate: (otp: string) => {
            if (!otp || otp.trim().length === 0) return false;
            return true;
        },
        message: 'Otp is Required or Invalid'
    },

    [ValidationField.REFRESH_TOKEN]: {
        validate: (token: string) => {
            if (!token) return false;
            return true;
        },
        message: 'Invalid refresh token format'
    },

    [ValidationField.ACCESS_TOKEN]: {
        validate: (token: string) => {
            if (!token) return false;
            if (!token.startsWith('Bearer ')) return false;
            const tokenValue = token.split('Bearer ')[1];
            if (!tokenValue || tokenValue.trim().length === 0) return false;
            return true;
        },
        message: 'Invalid access token format'
    }
};

export class ValidationService {

    /**
     * Validates specified fields in the request
     * @param request - The request object to validate
     * @param fields - Array of fields to validate
     * @returns ValidationResponse indicating success or failure
    */

    public static validate(request: IRequest, fields: ValidationField[]): ValidationResponse {
        for (const field of fields) {
            const value = this.getValueFromRequest(request, field);
            const rule = ValidationRules[field];

            if (!rule.validate(value)) {
                return {
                    success: false,
                    message: rule.message
                };
            }
        }

        return { success: true };
    }

    private static readonly requestFieldPaths: Record<ValidationField, string> = {
        [ValidationField.REQUEST_BODY]: 'body',
        [ValidationField.EMAIL]: 'body.email',
        [ValidationField.PASSWORD]: 'body.password',
        [ValidationField.ACCESS_TOKEN]: 'headers.x-access-token',
        [ValidationField.REFRESH_TOKEN]: 'body.refreshToken',
        [ValidationField.REQUEST_HEADERS]: 'headers',
        [ValidationField.OTP]:'body.answer'
    };
    
    private static getValueFromRequest(request: IRequest, field: ValidationField): any {
        if (!request) return undefined;
        const path = this.requestFieldPaths[field];
        return path?.split('.').reduce<any>((obj, key) => {
            return obj ? obj[key] : undefined;
        }, request);
    }
}

// Usage example:
/*
const signupFunc = async (request: IRequest): Promise<IResponse> => {
    const validationResult = ValidationService.validate(request, [
        ValidationField.REQUEST_BODY,
        ValidationField.EMAIL,
        ValidationField.PASSWORD
    ]);

    if (!validationResult.success) {
        throw new ValidationError(validationResult.message!, Fault.CLIENT, true);
    }

    // Proceed with signup logic...
};
*/