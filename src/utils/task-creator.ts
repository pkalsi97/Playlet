import { Task,Location,TaskType, WorkerType } from '../types/task.types';

export class TaskCreator {
    public static createTask(
        userId: string,
        assetId: string,
        input: Location,
        output: Location,
        type: TaskType,
        worker: WorkerType,
        metadata?: any
    ): Task {
        return {
            taskId: `${type}-${crypto.randomUUID()}`,
            userId,
            assetId,
            input,
            output,
            type,
            worker,
            createdAt: new Date().toISOString(),
            metadata
        };
    }
};