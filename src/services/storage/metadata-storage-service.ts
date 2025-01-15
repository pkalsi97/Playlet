// // relationship between user and asset
// // asset and encodings
// // asset and gops

// // overall status tracking
// // gop task 

// interface AssetRecord {
//     PK: string;
//     SK: string;

//     assetId: string;
//     userId: string;
//     originalKey: string;
//     status: 'PROCESSING' | 'READY' | 'FAILED';
//     createdAt: string;
//     updatedAt: string;

//     validation: {
//         basic: BasicValidationResult;
//         stream: StreamValidationResult;
//     };
//     metadata: {
//         technical: TechnicalMetadata;
//         quality: QualityMetrics;
//         content: ContentMetadata;
//     };

//     gops: {
//         total: number;
//         segments: {
//             sequence: number;
//             path: string;
//             duration: number;
//             status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
//         }[];
//     };

//     transcoding: {
//         status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
//         qualities: {
//             [quality: string]: {
//                 status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
//                 segments: {
//                     gopIndex: number;
//                     path: string;
//                     status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
//                 }[];
//             };
//         };
//     };

//     delivery: {
//         masterPlaylist: string;
//         qualityPlaylists: {
//             [quality: string]: string;
//         };
//         baseUrl: string;
//     };
// }