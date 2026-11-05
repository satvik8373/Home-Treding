import type { CloudRequest, CloudResponse } from '../server/cloud/database.ts'
export declare function cloudDispatch(request: CloudRequest, env: NodeJS.ProcessEnv): Promise<CloudResponse>;
