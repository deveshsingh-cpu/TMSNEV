import { Router, Request, Response } from 'express';
import { sheetsDb } from '../sheets/sheetsService.js';

export const apiRouter = Router();

apiRouter.use(async (_req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  await sheetsDb.ensureInitialized();
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
apiRouter.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    if (req.query.fresh === '1') {
      await sheetsDb.ensureInitialized(true);
    }
    const status = await sheetsDb.getStatus();
    const students = sheetsDb.getStudents();
    const trips = sheetsDb.getTrips();
    const vehicles = sheetsDb.getVehicles();
    const invoices = sheetsDb.getInvoices();
    const receipts = sheetsDb.getReceipts();
    const accounts = sheetsDb.getAccounts();
    const expenses = sheetsDb.getExpenses();

    res.json({
      attendance: sheetsDb.getAllAttendance(),
      masters: {
        config: sheetsDb.getSchoolConfig(),
        campuses: sheetsDb.getCampuses(),
        memberTypes: sheetsDb.getMemberTypes(),
        classes: sheetsDb.getClasses(),
        sections: sheetsDb.getSections(),
        trips: sheetsDb.getTripsMaster(),
        designations: sheetsDb.getDesignationsMaster(),
        villages: sheetsDb.getVillages(),
        vehicles,
        routes: sheetsDb.getRoutes(),
        users: sheetsDb.getUsers(),
      },
      status,
      students,
      employees: sheetsDb.getEmployees(),
      resumes: sheetsDb.getResumes(),
      trips,
      services: sheetsDb.getScheduledServices(),
      invoices,
      receipts,
      warningLetters: sheetsDb.getWarningLetters(),
      expenses,
      expenseHeads: sheetsDb.getExpenseHeads(),
      incomeHeads: sheetsDb.getIncomeHeads(),
      incomes: sheetsDb.getIncomes(),
      odometerLogs: sheetsDb.getOdometerLogs(),
      fuelAdvances: sheetsDb.getFuelAdvances(),
      maintenance: sheetsDb.getMaintenanceRequests(),
      accounts,
      vouchers: sheetsDb.getVouchers(),
      reportsSummary: {
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
      },
      followUps: sheetsDb.getFollowUps(),
      disciplineRecords: sheetsDb.getDisciplineRecords(),
      vehicleAssignments: sheetsDb.getVehicleAssignments(),
      staffAttendance: sheetsDb.getStaffAttendance(),
      staffAdvances: sheetsDb.getStaffAdvances(),
      staffPayrolls: sheetsDb.getStaffPayrolls(),
      holidays: sheetsDb.getHolidays(),
    });
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
apiRouter.post('/attendance/:id/mark', async (req: Request, res: Response) => {
  try {
    const { source, value } = req.body;
    const updated = await sheetsDb.updateAttendanceObservation(req.params.id, source, value);
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
    const { verifiedBy, notes, statusOverride, inTime, outTime, inStrength, outStrength } = req.body;
    const trip = await sheetsDb.verifyTrip(req.params.id, verifiedBy, notes, statusOverride, {
      inTime,
      outTime,
      inStrength,
      outStrength,
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
