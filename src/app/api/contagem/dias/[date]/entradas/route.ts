import { getCountingAttendance } from '@/lib/counting-attendance';
import { runCountingRoute } from '@/lib/trip-counting-route';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{date:string}>}){const {date}=await params;return runCountingRoute(request,async()=>Response.json({ok:true,data:await getCountingAttendance(date)}));}
