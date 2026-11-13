import {ownerReadRoute} from '@/lib/owner-route';
export const runtime='nodejs';
export function GET(request:Request){return ownerReadRoute(request,false,async data=>Response.json({ok:true,data}));}
