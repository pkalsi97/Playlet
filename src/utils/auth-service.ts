import {
    CognitoIdentityProviderClient,
    SignUpCommand,
    AdminUpdateUserAttributesCommand,
    InitiateAuthCommand,
    AdminConfirmSignUpCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    GlobalSignOutCommand,
    InitiateAuthCommandOutput,
    ForgotPasswordCommandOutput,
    ConfirmForgotPasswordCommandOutput,
    AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export class AuthService{
    private cognitoClient: CognitoIdentityProviderClient;
    private readonly userpoolId: string;
    private readonly clientId: string;
    private readonly region: string;

    constructor(userpoolId:string,clientId:string,region:string){
        this.userpoolId = userpoolId;
        this.clientId = clientId;
        this.region = region;
        this.cognitoClient = new CognitoIdentityProviderClient({region:this.region});
    };

    public async createUser(email:string,password:string):Promise<boolean>{
        const createUserCommand = new SignUpCommand({
            ClientId: this.clientId,
            Username:email,
            Password:password,
            UserAttributes: [ 
                { 
                  Name: "email",
                  Value: email,
                },
              ],
        });
        const createUserResponse = await this.cognitoClient.send(createUserCommand);
        if(!createUserResponse.UserSub) return false;

        const adminUpdateUserAttributeResponse = await this.adminUpdateUserAttribute(email);
        if(!adminUpdateUserAttributeResponse){
            await this.adminDeleteUser(email);
            return false;
        }

        const confirmUserResponse = await this.adminConfirmUser(email);
        if(!confirmUserResponse){
            await this.adminDeleteUser(email);
            return false;
        }
        return true;
    };

    private async adminDeleteUser(email:string):Promise<boolean> {
        const command = new AdminDeleteUserCommand({
            UserPoolId: this.userpoolId,
            Username: email,
        });
        const response = await this.cognitoClient.send(command);
        return response?true:false;
    }

    private async adminUpdateUserAttribute(email:string):Promise<boolean> {
        const command = new AdminUpdateUserAttributesCommand({
            UserPoolId: this.userpoolId,
            Username: email,
            UserAttributes: [
                { 
                    Name: "email_verified",
                    Value: "true",
                },
            ],
        });

        const response = await this.cognitoClient.send(command);
        return response?true:false;
    };

    private async adminConfirmUser(email:string):Promise<boolean>{
        const command = new AdminConfirmSignUpCommand({
            UserPoolId: this.userpoolId,
            Username: email,
        });
        const response = await this.cognitoClient.send(command);
        return response?true:false;
    };

    public async login(email:string,password:string):Promise<InitiateAuthCommandOutput['AuthenticationResult']>{
        const command = new InitiateAuthCommand({
            ClientId:this.clientId,
            AuthFlow:"USER_PASSWORD_AUTH",
            AuthParameters:{
                USERNAME:email,
                PASSWORD:password,
            },
        });
    
        const response = await this.cognitoClient.send(command);
        return response.AuthenticationResult;
    };

    public async forgetPassword(email:string):Promise<ForgotPasswordCommandOutput["CodeDeliveryDetails"]>{
        const command = new ForgotPasswordCommand({
            ClientId:this.clientId,
            Username: email,
        });

        const response = await this.cognitoClient.send(command);
        return response.CodeDeliveryDetails;
    };

    public async confirmForgetPassword(email:string,password:string,answer:string):Promise<boolean>{
        const command = new ConfirmForgotPasswordCommand({
            ClientId:this.clientId,
            Username:email,
            ConfirmationCode:answer,
            Password:password,
        });
        const response = await this.cognitoClient.send(command);
        if(!response) return false;
        return true;
    }

    public async logout(accessToken:string):Promise<boolean>{
        const command = new GlobalSignOutCommand({
            AccessToken:accessToken,
        });
        const response = await this.cognitoClient.send(command);
        return true;
    }

    public async refreshToken(refreshToken:string):Promise<InitiateAuthCommandOutput['AuthenticationResult']>{
        const command = new InitiateAuthCommand({
            AuthFlow:"REFRESH_TOKEN_AUTH",
            ClientId:this.clientId,
            AuthParameters:{
                REFRESH_TOKEN:refreshToken
            }
        });
    
        const response = await this.cognitoClient.send(command);
        return response.AuthenticationResult;
    }
};
