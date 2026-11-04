import { Router, Request, Response } from 'express';
import { sheetsDb } from '../sheets/sheetsService.js';

export const apiRouter = Router();

apiRouter.use(async (req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'GET') {
    await sheetsDb.ensureInitialized(req.query.fresh === '1');
  } else {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (
        res.statusCode < 400 &&
        req.headers['x-erp-include-bootstrap'] === '1' &&
        (!body || typeof body !== 'object' || !body.__erpEnvelope)
      ) {
        return originalJson({
          __erpEnvelope: true,
          result: body,
          bootstrap: sheetsDb.getBootstrapSnapshot(),
        });
      }
      return originalJson(body);
    }) as any;
  }
  next();
});

// 1. Google Sheets Connection & Diagnostic Status
apiRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await sheetsDb.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sheets/provision', async (_req: Request, res: Response) => {
  try {
    const result = await sheetsDb.provisionSpreadsheetTabs();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sheets/sync', async (_req: Request, res: Response) => {
  try {
    const result = await sheetsDb.syncToGoogleSheets();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sheets/credentials', async (req: Request, res: Response) => {
  try {
    const status = await sheetsDb.configureCredentialsAtRuntime(req.body || {});
    res.json(status);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Unified Single-Request Bootstrap (Prevents multi-instance serverless race conditions)
apiRouter.get('/bootstrap', async (_req: Request, res: Response) => {
  try {
    res.json(sheetsDb.getBootstrapSnapshot());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. School Configuration & Branding (Under Masters)
apiRouter.get('/config', (_req: Request, res: Response) => {
  res.json(sheetsDb.getSchoolConfig());
});

apiRouter.put('/config', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.updateSchoolConfig(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 2.5 Authentication & System Users
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    const user = await sheetsDb.authenticateUser(username, password);
    res.json(user);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

apiRouter.get('/users', (_req: Request, res: Response) => {
  res.json(sheetsDb.getUsers());
});

apiRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const saved = await sheetsDb.saveUser(req.body);
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteUser(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Complete Masters Aggregator
apiRouter.get('/masters', (_req: Request, res: Response) => {
  res.json({
    config: sheetsDb.getSchoolConfig(),
    campuses: sheetsDb.getCampuses(),
    memberTypes: sheetsDb.getMemberTypes(),
    classes: sheetsDb.getClasses(),
    sections: sheetsDb.getSections(),
    trips: sheetsDb.getTripsMaster(),
    designations: sheetsDb.getDesignationsMaster(),
    villages: sheetsDb.getVillages(),
    vehicles: sheetsDb.getVehicles(),
    routes: sheetsDb.getRoutes(),
    users: sheetsDb.getUsers(),
  });
});

// Masters: Campuses
apiRouter.get('/masters/campuses', (_req: Request, res: Response) => {
  res.json(sheetsDb.getCampuses());
});
apiRouter.post('/masters/campuses', async (req: Request, res: Response) => {
  try {
    const campuses = await sheetsDb.addCampus(req.body);
    res.json(campuses);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put('/masters/campuses/:id', async (req: Request, res: Response) => {
  try {
    const campuses = await sheetsDb.updateCampus(req.params.id, req.body);
    res.json(campuses);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/campuses/:id', async (req: Request, res: Response) => {
  try {
    const campuses = await sheetsDb.removeCampus(req.params.id);
    res.json(campuses);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Member Types
apiRouter.get('/masters/member-types', (_req: Request, res: Response) => {
  res.json(sheetsDb.getMemberTypes());
});
apiRouter.post('/masters/member-types', async (req: Request, res: Response) => {
  try {
    const memberTypes = await sheetsDb.addMemberType(req.body.name);
    res.json(memberTypes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put('/masters/member-types/:id', async (req: Request, res: Response) => {
  try {
    const memberTypes = await sheetsDb.updateMemberType(req.params.id, req.body.name);
    res.json(memberTypes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/member-types/:id', async (req: Request, res: Response) => {
  try {
    const memberTypes = await sheetsDb.removeMemberType(req.params.id);
    res.json(memberTypes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Classes
apiRouter.get('/masters/classes', (_req: Request, res: Response) => {
  res.json(sheetsDb.getClasses());
});
apiRouter.post('/masters/classes', async (req: Request, res: Response) => {
  try {
    const classes = await sheetsDb.addClass(req.body.name);
    res.json(classes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put('/masters/classes', async (req: Request, res: Response) => {
  try {
    const classes = await sheetsDb.updateClass(req.body.oldName, req.body.newName);
    res.json(classes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/classes/:name', async (req: Request, res: Response) => {
  try {
    const classes = await sheetsDb.removeClass(req.params.name);
    res.json(classes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Sections
apiRouter.get('/masters/sections', (_req: Request, res: Response) => {
  res.json(sheetsDb.getSections());
});
apiRouter.post('/masters/sections', async (req: Request, res: Response) => {
  try {
    const sections = await sheetsDb.addSection(req.body.name);
    res.json(sections);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put('/masters/sections', async (req: Request, res: Response) => {
  try {
    const sections = await sheetsDb.updateSection(req.body.oldName, req.body.newName);
    res.json(sections);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/sections/:name', async (req: Request, res: Response) => {
  try {
    const sections = await sheetsDb.removeSection(req.params.name);
    res.json(sections);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Trips (1, 2, 3...)
apiRouter.get('/masters/trips', (_req: Request, res: Response) => {
  res.json(sheetsDb.getTripsMaster());
});
apiRouter.post('/masters/trips', async (req: Request, res: Response) => {
  try {
    const trips = await sheetsDb.addTripMaster(req.body);
    res.json(trips);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put('/masters/trips/:id', async (req: Request, res: Response) => {
  try {
    const trips = await sheetsDb.updateTripMaster(req.params.id, req.body);
    res.json(trips);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/trips/:id', async (req: Request, res: Response) => {
  try {
    const trips = await sheetsDb.removeTripMaster(req.params.id);
    res.json(trips);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Designations & Permissions
apiRouter.get('/masters/designations', (_req: Request, res: Response) => {
  res.json(sheetsDb.getDesignationsMaster());
});
apiRouter.post('/masters/designations', async (req: Request, res: Response) => {
  try {
    const des = await sheetsDb.saveDesignation(req.body);
    res.json(des);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/designations/:id', async (req: Request, res: Response) => {
  try {
    const designations = await sheetsDb.removeDesignation(req.params.id);
    res.json(designations);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Villages & Transport Stops
apiRouter.get('/villages', (_req: Request, res: Response) => {
  res.json(sheetsDb.getVillages());
});
apiRouter.post('/masters/villages', async (req: Request, res: Response) => {
  try {
    const village = await sheetsDb.saveVillage(req.body);
    res.json(village);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/villages/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteVillage(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Vehicles
apiRouter.get('/vehicles', (_req: Request, res: Response) => {
  res.json(sheetsDb.getVehicles());
});
apiRouter.post('/masters/vehicles', async (req: Request, res: Response) => {
  try {
    const vehicle = await sheetsDb.saveVehicle(req.body);
    res.json(vehicle);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/vehicles/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteVehicle(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Masters: Routes (Nomenclature: Campus/VehicleLast4/Trip e.g. Sr/7175/1)
apiRouter.get('/routes', (_req: Request, res: Response) => {
  res.json(sheetsDb.getRoutes());
});
apiRouter.post('/masters/routes', async (req: Request, res: Response) => {
  try {
    const route = await sheetsDb.saveRoute(req.body);
    res.json(route);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/masters/routes/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteRoute(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/routes/:id/timings', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.updateRouteTimings(req.params.id, req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Vehicle-Driver-Helper Assignments & Date History
apiRouter.get('/vehicle-assignments', (_req: Request, res: Response) => {
  res.json(sheetsDb.getVehicleAssignments());
});
apiRouter.post('/vehicle-assignments', async (req: Request, res: Response) => {
  try {
    const rec = await sheetsDb.assignVehicleDriverHelper(req.body);
    res.json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Candidate Resumes & Employees
apiRouter.get('/resumes', (_req: Request, res: Response) => {
  res.json(sheetsDb.getResumes());
});
apiRouter.post('/resumes', async (req: Request, res: Response) => {
  try {
    const resume = await sheetsDb.saveResume(req.body);
    res.json(resume);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/resumes/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteResume(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/resumes/:id/hire', async (req: Request, res: Response) => {
  try {
    const { salaryOverride, designationIdOverride } = req.body;
    const emp = await sheetsDb.hireResumeAsEmployee(req.params.id, salaryOverride, designationIdOverride);
    res.json(emp);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/employees', (_req: Request, res: Response) => {
  res.json(sheetsDb.getEmployees());
});
apiRouter.post('/employees', async (req: Request, res: Response) => {
  try {
    const emp = await sheetsDb.saveEmployee(req.body);
    res.json(emp);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/employees/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteEmployee(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4B. Staff Attendance, Holidays, Advances & Payroll
apiRouter.get('/staff-attendance', (req: Request, res: Response) => {
  const { date, month } = req.query as { date?: string; month?: string };
  res.json(sheetsDb.getStaffAttendance(date, month));
});
apiRouter.post('/staff-attendance', async (req: Request, res: Response) => {
  try {
    const rec = await sheetsDb.markStaffAttendance(req.body);
    res.json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/holidays', (_req: Request, res: Response) => {
  res.json(sheetsDb.getHolidays());
});
apiRouter.post('/holidays', async (req: Request, res: Response) => {
  try {
    const rec = await sheetsDb.addHoliday(req.body);
    res.json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/holidays/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteHoliday(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/staff-advances', (_req: Request, res: Response) => {
  res.json(sheetsDb.getStaffAdvances());
});
apiRouter.post('/staff-advances', async (req: Request, res: Response) => {
  try {
    const rec = await sheetsDb.giveStaffAdvance(req.body);
    res.json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/staff-payrolls', (req: Request, res: Response) => {
  const { month } = req.query as { month?: string };
  res.json(sheetsDb.getStaffPayrolls(month));
});
apiRouter.post('/staff-payrolls', async (req: Request, res: Response) => {
  try {
    const rec = await sheetsDb.finalizeStaffPayroll(req.body);
    res.json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


// 5. Students & Memberships (Combined Pickup & Drop Stop)
apiRouter.get('/students', (req: Request, res: Response) => {
  const { campus, status, query } = req.query as { campus?: string; status?: string; query?: string };
  res.json(sheetsDb.getStudents({ campus, status, query }));
});
apiRouter.post('/students', async (req: Request, res: Response) => {
  try {
    const saved = await sheetsDb.saveStudent(req.body);
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/students/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteStudent(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/students/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const { authorizedBy, reason } = req.body;
    const reactivated = await sheetsDb.reactivateMember(req.params.id, authorizedBy || 'Admin', reason || 'Dues cleared');
    res.json(reactivated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/students/:id/permission-letter', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.grantPermissionLetter(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/students/:id/suspend', async (req: Request, res: Response) => {
  try {
    const { reason, authorizedBy } = req.body;
    const updated = await sheetsDb.suspendStudent(req.params.id, reason, authorizedBy || 'Admin');
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/students/:id/suspension-approval', async (req: Request, res: Response) => {
  try {
    const { action, reviewedBy, rejectionReason } = req.body;
    const updated = await sheetsDb.reviewSuspensionRequest(
      req.params.id,
      action === 'Reject' ? 'Reject' : 'Approve',
      reviewedBy || 'Admin',
      rejectionReason
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/students/previous-dues/bulk', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.bulkSetPreviousDues(req.body?.entries || []);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/students/:id/previous-dues', async (req: Request, res: Response) => {
  try {
    const { amount, remarks } = req.body || {};
    const updated = await sheetsDb.setStudentPreviousDues(req.params.id, Number(amount) || 0, remarks);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. 24-Hour Daily Log Book (No shift needed)
apiRouter.get('/odometer', (req: Request, res: Response) => {
  const { vehicleId } = req.query as { vehicleId?: string };
  res.json(sheetsDb.getOdometerLogs(vehicleId));
});
apiRouter.post('/odometer', async (req: Request, res: Response) => {
  try {
    const entry = await sheetsDb.recordOdometerEntry(req.body);
    res.json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Expenses & Ledgers
apiRouter.get('/expenses', (req: Request, res: Response) => {
  const { vehicleNumber, category } = req.query as { vehicleNumber?: string; category?: string };
  res.json(sheetsDb.getExpenses(vehicleNumber, category));
});
apiRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const expense = await sheetsDb.addExpense(req.body);
    res.json(expense);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/expenses/:id/approval', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.updateExpenseApproval(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteExpense(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Dynamic Expense Heads & Income Heads & Incomes
apiRouter.get('/expense-heads', (_req: Request, res: Response) => {
  res.json(sheetsDb.getExpenseHeads());
});
apiRouter.post('/expense-heads', async (req: Request, res: Response) => {
  try {
    const head = await sheetsDb.saveExpenseHead(req.body);
    res.json(head);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/expense-heads/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteExpenseHead(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/income-heads', (_req: Request, res: Response) => {
  res.json(sheetsDb.getIncomeHeads());
});
apiRouter.post('/income-heads', async (req: Request, res: Response) => {
  try {
    const head = await sheetsDb.saveIncomeHead(req.body);
    res.json(head);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/income-heads/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteIncomeHead(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/incomes', (_req: Request, res: Response) => {
  res.json(sheetsDb.getIncomes());
});
apiRouter.post('/incomes', async (req: Request, res: Response) => {
  try {
    const inc = await sheetsDb.addIncome(req.body);
    res.json(inc);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/incomes/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteIncome(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Behaviour & Discipline Records
apiRouter.get('/discipline', (_req: Request, res: Response) => {
  res.json(sheetsDb.getDisciplineRecords());
});
apiRouter.post('/discipline', async (req: Request, res: Response) => {
  try {
    const rec = await sheetsDb.saveDisciplineRecord(req.body);
    res.json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/discipline/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteDisciplineRecord(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/services', (_req: Request, res: Response) => {
  res.json(sheetsDb.getScheduledServices());
});

apiRouter.get('/fuel-advances', (_req: Request, res: Response) => {
  res.json(sheetsDb.getFuelAdvances());
});
apiRouter.post('/fuel-advances/settle', async (req: Request, res: Response) => {
  try {
    const settled = await sheetsDb.settleFuelAdvance(req.body);
    res.json(settled);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/maintenance', (_req: Request, res: Response) => {
  res.json(sheetsDb.getMaintenance());
});
apiRouter.post('/maintenance', async (req: Request, res: Response) => {
  try {
    const maint = await sheetsDb.addMaintenance(req.body);
    res.json(maint);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/maintenance/:id/status', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.updateMaintenanceStatus(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Accounts & Financial Control
apiRouter.get('/accounts', (_req: Request, res: Response) => {
  res.json(sheetsDb.getAccounts());
});
apiRouter.get('/vouchers', (_req: Request, res: Response) => {
  res.json(sheetsDb.getVouchers());
});
apiRouter.post('/vouchers', async (req: Request, res: Response) => {
  try {
    const voucher = await sheetsDb.postJournalVoucher(req.body);
    res.json(voucher);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Fees, Invoices & Receipts
apiRouter.get('/invoices', (req: Request, res: Response) => {
  const { month } = req.query as { month?: string };
  res.json(sheetsDb.getInvoices(month));
});
apiRouter.post('/billing/run', async (req: Request, res: Response) => {
  try {
    const { month, runBy } = req.body;
    const result = await sheetsDb.runMonthlyBilling(month || '2026-10', runBy || 'Admin');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.get('/receipts', (_req: Request, res: Response) => {
  res.json(sheetsDb.getReceipts());
});
apiRouter.post('/receipts', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.recordReceipt(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put('/receipts/:id/attachment', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.updateReceiptAttachment(req.params.id, req.body?.upiScreenshot);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/receipts/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteReceipt(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.get('/follow-ups', (_req: Request, res: Response) => {
  res.json(sheetsDb.getFollowUps());
});
apiRouter.post('/follow-ups', async (req: Request, res: Response) => {
  try {
    const rec = await sheetsDb.addFollowUp(req.body);
    res.json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete('/follow-ups/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteFollowUp(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/warning-letters', (_req: Request, res: Response) => {
  res.json(sheetsDb.getWarningLetters());
});
apiRouter.post('/warning-letters', async (req: Request, res: Response) => {
  try {
    const wl = await sheetsDb.issueWarningLetter(req.body);
    res.json(wl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/recovery/evaluate-suspensions', async (req: Request, res: Response) => {
  try {
    const { thresholdAmount, triggeredBy } = req.body;
    const result = await sheetsDb.evaluateOverdueSuspensions(thresholdAmount, triggeredBy);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Operations & Trips
apiRouter.get('/trips', (req: Request, res: Response) => {
  const { date, campus } = req.query as { date?: string; campus?: string };
  res.json(sheetsDb.getTrips(date, campus));
});
apiRouter.post('/trips/for-route', async (req: Request, res: Response) => {
  try {
    const { date, routeId } = req.body;
    const result = await sheetsDb.getOrCreateTripForRoute(date || new Date().toISOString().split('T')[0], routeId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.get('/trips/:id/attendance', (req: Request, res: Response) => {
  res.json(sheetsDb.getTripAttendance(req.params.id));
});
apiRouter.post('/attendance/batch-save', async (req: Request, res: Response) => {
  try {
    const { entries, role } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Entries array is required' });
    }
    const updated = await sheetsDb.batchSaveAttendanceObservations(entries, role);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/attendance/:id/mark', async (req: Request, res: Response) => {
  try {
    const { source, value, reason, role } = req.body;
    const updated = await sheetsDb.updateAttendanceObservation(req.params.id, source, value, undefined, reason, role);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/attendance/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { value, resolverName, reason } = req.body;
    const updated = await sheetsDb.updateAttendanceObservation(req.params.id, 'resolve', value, resolverName, reason);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/trips/:id/verify', async (req: Request, res: Response) => {
  try {
    const { verifiedBy, notes, statusOverride, inTime, outTime, inStrength, outStrength, strengthMismatchRemark } = req.body;
    const trip = await sheetsDb.verifyTrip(req.params.id, verifiedBy, notes, statusOverride, {
      inTime,
      outTime,
      inStrength,
      outStrength,
      strengthMismatchRemark,
    });
    res.json(trip);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post('/trips/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { reason, cancelledBy } = req.body;
    const trip = await sheetsDb.cancelTrip(req.params.id, reason, cancelledBy || 'Coordinator');
    res.json(trip);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/attendance/all', (_req: Request, res: Response) => {
  res.json(sheetsDb.getAllAttendance());
});

apiRouter.get('/driver-register/pack', (req: Request, res: Response) => {
  const { routeId, shiftName, weekStartDate, weekEndDate } = req.query as {
    routeId: string;
    shiftName: string;
    weekStartDate: string;
    weekEndDate?: string;
  };
  const pack = sheetsDb.generateDriverWeeklyPack(
    routeId || '', 
    shiftName || 'Trip 1', 
    weekStartDate || new Date().toISOString().split('T')[0],
    weekEndDate
  );
  res.json(pack);
});

// 11. Staged Import
apiRouter.post('/import/stage', async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Rows array required' });
    const result = await sheetsDb.stageImportStudents(rows);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Summary for Dashboard & Reports
apiRouter.get('/reports/summary', (_req: Request, res: Response) => {
  const students = sheetsDb.getStudents();
  const trips = sheetsDb.getTrips();
  const vehicles = sheetsDb.getVehicles();
  const invoices = sheetsDb.getInvoices();
  const receipts = sheetsDb.getReceipts();
  const accounts = sheetsDb.getAccounts();
  const expenses = sheetsDb.getExpenses();

  res.json({
    metrics: {
      totalStudents: students.length,
      activeStudents: students.filter(s => s.transportStatus === 'Active').length,
      suspendedStudents: students.filter(s => s.transportStatus === 'Suspended').length,
      needsSetupStudents: students.filter(s => s.transportStatus === 'Needs Setup').length,
      totalBilled: invoices.reduce((s, i) => s + i.netAmount, 0),
      totalCollected: receipts.reduce((s, r) => s + r.amount, 0),
      totalOutstanding: students.reduce((s, st) => s + st.balanceDue, 0),
      totalVehicles: vehicles.length,
      availableVehicles: vehicles.filter(v => v.availability === 'Available').length,
      totalTripsToday: trips.length,
      tripsArrived: trips.filter(t => t.status === 'Arrived').length,
      tripsPending: trips.filter(t => t.status === 'Ready' || t.status === 'Planned').length,
      mismatchesCount: trips.reduce((s, t) => s + t.mismatchCount, 0),
      totalFuelSpend: expenses.filter(e => e.approvalStatus !== 'Pending Approval' && e.approvalStatus !== 'Rejected' && e.category.includes('Fuel')).reduce((s, e) => s + e.amount, 0),
      totalRepairsSpend: expenses.filter(e => e.approvalStatus !== 'Pending Approval' && e.approvalStatus !== 'Rejected' && e.category.includes('Repairs')).reduce((s, e) => s + e.amount, 0),
      totalExpensesAll: expenses.filter(e => e.approvalStatus !== 'Pending Approval' && e.approvalStatus !== 'Rejected').reduce((s, e) => s + e.amount, 0),
      unsettledAdvances: 0,
    },
    accountsOverview: accounts,
  });
});

// 13. Session Months Attachment & Edit Transport Fees Setup
apiRouter.post('/masters/fees-setup', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.updateFeesSetup(req.body || {});
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 14. Multi-Stage Member Lifecycle Approval Requests (Add / Drop Left School / Suspend)
apiRouter.get('/member-requests', (_req: Request, res: Response) => {
  res.json(sheetsDb.getMemberRequests());
});

apiRouter.post('/member-requests', async (req: Request, res: Response) => {
  try {
    const created = await sheetsDb.createMemberLifecycleRequest(req.body || {});
    res.json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/member-requests/:id/coordinator-review', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.coordinatorReviewMemberRequest(req.params.id, req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/member-requests/:id/admin-review', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.adminReviewMemberRequest(req.params.id, req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 15. Attendance Module — Call Absentees, Consecutive Absence Escalation & Expected Return Date
apiRouter.get('/absentee-calls', (req: Request, res: Response) => {
  const { date, campus } = req.query as { date?: string; campus?: string };
  res.json(sheetsDb.getAbsenteeCalls(date, campus));
});

apiRouter.post('/absentee-calls', async (req: Request, res: Response) => {
  try {
    const saved = await sheetsDb.saveAbsenteeCall(req.body || {});
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/absentee-calls/confirm-early-arrival', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.confirmEarlyArrival(req.body || {});
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 16. Feedback & Complaint Module (Grievances & Feedbacks from Members / Parents)
apiRouter.get('/complaints', (req: Request, res: Response) => {
  const { campus, status } = req.query as { campus?: string; status?: string };
  res.json(sheetsDb.getComplaints(campus, status));
});

apiRouter.post('/complaints', async (req: Request, res: Response) => {
  try {
    const saved = await sheetsDb.saveComplaint(req.body || {});
    res.json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/complaints/:id/resolve', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsDb.resolveComplaint(req.params.id, req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/complaints/:id', async (req: Request, res: Response) => {
  try {
    const result = await sheetsDb.deleteComplaint(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 17. Dedicated Top-Level Print Page Endpoint (escapes iframe sandbox without allow-modals)
apiRouter.post('/print-page', (req: Request, res: Response) => {
  const rawTitle = String(req.body?.title || 'Document Print');
  const rawSubtitle = String(req.body?.subtitle || '');
  const rawHtml = String(req.body?.html || '');

  const safeTitle = rawTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const safeSubtitle = rawSubtitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const styleMatches = rawHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : rawHtml;

  const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-toolbar-title {
      font-size: 14px;
      font-weight: 800;
      color: #ffffff;
    }
    .print-toolbar-sub {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .print-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-print-now {
      background: #f59e0b;
      color: #0f172a;
      border: none;
      padding: 9px 18px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-close-tab {
      background: #334155;
      color: #ffffff;
      border: 1px solid #475569;
      padding: 9px 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }
    .print-sheet {
      max-width: 210mm;
      margin: 20px auto;
      background: #ffffff;
      color: #0f172a;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { color: #0f172a; }
    @media print {
      html, body {
        background: #ffffff !important;
      }
      .print-toolbar {
        display: none !important;
      }
      .print-sheet {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
  ${styleMatches.join('\n')}
</head>
<body>
  <div class="print-toolbar">
    <div>
      <div class="print-toolbar-title">${safeTitle}</div>
      ${safeSubtitle ? `<div class="print-toolbar-sub">${safeSubtitle}</div>` : ''}
    </div>
    <div class="print-toolbar-actions">
      <button type="button" class="btn-print-now" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button type="button" class="btn-close-tab" onclick="window.close()">✕ Close</button>
    </div>
  </div>
  <div class="print-sheet">
    ${bodyContent}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(pageHtml);
});

// Helper: CRC32 + PKZIP builder for standalone .apk package fallback
function crc32Buffer(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildApkArchiveBuffer(appOrigin: string): Buffer {
  const files: { name: string; content: Buffer }[] = [
    {
      name: 'AndroidManifest.xml',
      content: Buffer.from(
        `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.narendraeduvalley.transport.erp"
    android:versionCode="1"
    android:versionName="1.0.0">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:label="Narendra Transit"
        android:allowBackup="true">
        <activity
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
            android:exported="true">
            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="${appOrigin}/?source=pwa" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`,
        'utf-8'
      ),
    },
    {
      name: 'assets/webapk-config.json',
      content: Buffer.from(
        JSON.stringify(
          {
            packageId: 'com.narendraeduvalley.transport.erp',
            name: 'Narendra Edu Valley — Transport Management System',
            shortName: 'Narendra Transit',
            startUrl: `${appOrigin}/?source=pwa`,
            manifestUrl: `${appOrigin}/manifest.webmanifest`,
            display: 'standalone',
            orientation: 'portrait',
            themeColor: '#0f172a',
            backgroundColor: '#0f172a',
          },
          null,
          2
        ),
        'utf-8'
      ),
    },
    {
      name: 'META-INF/MANIFEST.MF',
      content: Buffer.from(
        'Manifest-Version: 1.0\r\nCreated-By: Narendra Edu Valley Transit ERP Packaging Engine\r\nPackage-Name: com.narendraeduvalley.transport.erp\r\n\r\n',
        'utf-8'
      ),
    },
  ];

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf-8');
    const dataBuf = f.content;
    const crc = crc32Buffer(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression (0 = store)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += 30 + nameBuf.length + dataBuf.length;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuffer, eocd]);
}

apiRouter.get('/download-apk', async (req: Request, res: Response) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
  const appOrigin = `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;

  // If running on a publicly reachable HTTPS domain, attempt to fetch a signed TWA APK from PWABuilder CloudAPK
  const isLocalHost =
    host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
  if (!isLocalHost && appOrigin.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const pwaRes = await fetch(
        'https://pwabuilder-cloudapk.azurewebsites.net/generateApk',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: 'com.narendraeduvalley.transport.erp',
            name: 'Narendra Transit',
            launcherName: 'Narendra Transit',
            display: 'standalone',
            orientation: 'portrait',
            themeColor: '#0f172a',
            navigationColor: '#0f172a',
            navigationColorDark: '#0f172a',
            navigationDividerColor: '#0f172a',
            navigationDividerColorDark: '#0f172a',
            backgroundColor: '#0f172a',
            enableNotifications: true,
            startUrl: '/?source=pwa',
            iconUrl: `${appOrigin}/icons/icon-512.png`,
            maskableIconUrl: `${appOrigin}/icons/icon-512.png`,
            appVersion: '1.0.0',
            appVersionCode: 1,
            signingMode: 'new',
            host: host.split(',')[0].trim(),
            webManifestUrl: `${appOrigin}/manifest.webmanifest`,
            fallbackType: 'customtabs',
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (pwaRes.ok) {
        const arrayBuf = await pwaRes.arrayBuffer();
        if (arrayBuf.byteLength > 1000) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="Narendra-Edu-Valley-Transport.apk"'
          );
          res.send(Buffer.from(arrayBuf));
          return;
        }
      }
    } catch {
      // Fall back to direct built-in APK archive below
    }
  }

  const apkBuffer = buildApkArchiveBuffer(appOrigin);
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="Narendra-Edu-Valley-Transport.apk"'
  );
  res.setHeader('Content-Length', String(apkBuffer.length));
  res.send(apkBuffer);
});

