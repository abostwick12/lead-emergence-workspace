import type {ExecutiveData,ExecutiveKind} from "../lib/executive-bundle/contracts";
export function executiveFixtures(today?:string): {[K in ExecutiveKind]:Extract<ExecutiveData,{recordType:K}>};
