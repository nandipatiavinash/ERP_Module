import { checkInAttendance, checkOutAttendance } from "@/app/(app)/_actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSessionPermissions, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTimeInIndia(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function localTimestamp(date: string | null | undefined, time: string | null | undefined) {
  if (!date || !time) return null;
  return `${date}T${time}+05:30`;
}

function effectiveCheckIn(row: any) {
  return row?.check_in_at ?? localTimestamp(row?.attendance_date, row?.check_in);
}

function effectiveCheckOut(row: any) {
  const start = effectiveCheckIn(row);
  const timestampEnd = row?.check_out_at ?? null;
  const legacyEnd = localTimestamp(row?.attendance_date, row?.check_out);
  if (start && timestampEnd && new Date(timestampEnd).getTime() > new Date(start).getTime()) return timestampEnd;
  if (start && legacyEnd && new Date(legacyEnd).getTime() > new Date(start).getTime()) return legacyEnd;
  return null;
}

function formatDateTimeInIndia(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function hoursBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 0;
  const hours = Math.max((new Date(end).getTime() - new Date(start).getTime()) / 36e5, 0);
  return Math.round(hours * 100) / 100;
}

function overtimeHours(row: any) {
  const end = effectiveCheckOut(row);
  if (!end || !row.attendance_date) return 0;
  const shiftEnd = row.employees?.shift_end ?? "18:00:00";
  const shiftEndAt = new Date(`${row.attendance_date}T${shiftEnd}+05:30`).getTime();
  return Math.max((new Date(end).getTime() - shiftEndAt) / 36e5, 0);
}

function attendanceStatus(row: any) {
  const start = effectiveCheckIn(row);
  const end = effectiveCheckOut(row);
  if (!start) return row?.status;
  if (!end) return "present";
  if (end) {
    const hours = hoursBetween(start, end);
    if (hours < 4) return "half_day";
    return "present";
  }
  return row.status;
}

export default async function AttendanceAdminPage() {
  const user = await requirePermission("admin.attendance");
  const permissions = await getSessionPermissions(user);
  const canManageAllAttendance = permissions.includes("employees.view") || permissions.includes("users.view");
  const supabase = await createClient();
  const today = todayInIndia();

  let employees: any[] = [];
  let attendanceRows: any[] = [];

  const employeeQuery = supabase
    .from("employees")
    .select("id, user_id, name, employee_code, shift_start, shift_end")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name");

  if (canManageAllAttendance) {
    const [empRes, attRes] = await Promise.all([
      employeeQuery,
      supabase
        .from("attendance")
        .select("id, employee_id, attendance_date, check_in, check_out, check_in_at, check_out_at, status, created_at, updated_at, employees(name, employee_code, shift_start, shift_end)")
        .is("deleted_at", null)
        .order("attendance_date", { ascending: false })
        .limit(100)
    ]);
    employees = empRes.data ?? [];
    attendanceRows = attRes.data ?? [];
  } else {
    const [empRes, attRes] = await Promise.all([
      employeeQuery.eq("user_id", user.id),
      supabase
        .from("attendance")
        .select("id, employee_id, attendance_date, check_in, check_out, check_in_at, check_out_at, status, created_at, updated_at, employees!inner(name, employee_code, shift_start, shift_end, user_id)")
        .eq("employees.user_id", user.id)
        .is("deleted_at", null)
        .order("attendance_date", { ascending: false })
        .limit(100)
    ]);
    employees = empRes.data ?? [];
    attendanceRows = attRes.data ?? [];
  }

  const todayByEmployee = new Map(attendanceRows.filter((row) => row.attendance_date === today).map((row) => [row.employee_id, row]));

  return (
    <>
      <PageHeader title="Attendance" description="Use server-time check in and check out. Status and hours are calculated automatically." />
      <Card className="mb-5">
        <CardHeader><CardTitle>Today</CardTitle></CardHeader>
        <CardContent>
          {(employees ?? []).length === 0 ? <EmptyState title="No linked employee" description={canManageAllAttendance ? "Add active employees before recording attendance." : "Ask an admin to link your ERP user to an employee record."} /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((employees ?? []) as any[]).map((employee) => {
                    const attendance = todayByEmployee.get(employee.id) as any;
                    const checkIn = effectiveCheckIn(attendance);
                    const checkOut = effectiveCheckOut(attendance);
                    const hasCheckedIn = Boolean(checkIn);
                    const hasCheckedOut = Boolean(checkOut);
                    const status = attendanceStatus(attendance);
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="font-medium">{employee.employee_code}</div>
                          <div className="text-sm text-muted-foreground">{employee.name}</div>
                        </TableCell>
                        <TableCell>{employee.shift_start} - {employee.shift_end}</TableCell>
                        <TableCell>{checkIn ? formatTimeInIndia(checkIn) : "-"}</TableCell>
                        <TableCell>{checkOut ? formatTimeInIndia(checkOut) : "-"}</TableCell>
                        <TableCell>{status ? <StatusBadge value={status} /> : "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <form action={checkInAttendance}>
                              <input type="hidden" name="employee_id" value={employee.id} />
                              <ConfirmSubmitButton size="sm" disabled={hasCheckedIn} confirmTitle="Check in employee?" confirmDescription="This will record the current server time as the check-in time.">Check In</ConfirmSubmitButton>
                            </form>
                            <form action={checkOutAttendance}>
                              <input type="hidden" name="employee_id" value={employee.id} />
                              <ConfirmSubmitButton size="sm" variant="outline" disabled={!hasCheckedIn || hasCheckedOut} confirmTitle="Check out employee?" confirmDescription="This will record the current server time as the check-out time.">Check Out</ConfirmSubmitButton>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Attendance</CardTitle></CardHeader>
        <CardContent>
          {attendanceRows.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Recorded At</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRows.map((row) => {
                    const checkIn = effectiveCheckIn(row);
                    const checkOut = effectiveCheckOut(row);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.attendance_date)}</TableCell>
                        <TableCell>{formatDateTimeInIndia(row.updated_at ?? row.created_at)}</TableCell>
                        <TableCell>{row.employees?.employee_code} - {row.employees?.name}</TableCell>
                        <TableCell>{checkIn ? formatTimeInIndia(checkIn) : "-"}</TableCell>
                        <TableCell>{checkOut ? formatTimeInIndia(checkOut) : "-"}</TableCell>
                        <TableCell>{formatNumber(checkIn && checkOut ? hoursBetween(checkIn, checkOut) : 0, 2)}</TableCell>
                        <TableCell>{formatNumber(overtimeHours(row), 2)}</TableCell>
                        <TableCell><StatusBadge value={attendanceStatus(row)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
