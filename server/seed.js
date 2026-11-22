import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { db, initDb } from './db.js';
import { hashPassword } from './security.js';

// ─── helpers ─────────────────────────────────────────────────────────────────
const uuid = () => randomUUID();
const q    = (sql, args = []) => db.query(sql, args);
const rnd  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** All weekdays (Mon–Fri) between start and end dates as yyyy-mm-dd strings */
function weekdays(startStr, endStr) {
  const days = [];
  const cur  = new Date(startStr + 'T00:00:00Z');
  const end  = new Date(endStr   + 'T00:00:00Z');
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// 3-month attendance window: Sep–Nov 2026 (Mon–Fri only)
const ATTEND_DAYS = weekdays('2026-09-01', '2026-11-28');

// ─── name banks ──────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aarav','Aditya','Ajay','Akash','Amrita','Ananya','Anjali','Arjun','Aryan',
  'Ashok','Ayesha','Bhavya','Chetan','Deepak','Deepika','Divya','Farhan',
  'Gaurav','Geetha','Harish','Hrithik','Ishaan','Jatin','Karan','Kavya',
  'Keerthi','Khushi','Kishore','Lavanya','Lokesh','Madhuri','Manoj','Meena',
  'Megha','Mohit','Nandini','Naveen','Neha','Nikhil','Nitin','Pooja','Pranav',
  'Preethi','Priya','Rahul','Rajeev','Ramesh','Ranjith','Rashmi','Ravi',
  'Rohit','Roshan','Sachin','Sahana','Sainath','Sandeep','Sanjay','Santosh',
  'Sarika','Sathvik','Shalini','Shankar','Shilpa','Shruti','Sidharth',
  'Simran','Sneha','Sohail','Srinivas','Sudha','Sumanth','Sunita','Suresh',
  'Swathi','Tanmay','Tejas','Teja','Uma','Usha','Vaishnavi','Varun','Vijay',
  'Vikram','Vineeth','Vishal','Vivek','Yamini','Yogesh','Yashwanth','Zoya',
  'Bharat','Chandra','Dhruv','Esha','Faisal','Gopal','Himani','Indira',
  'Jayesh','Kavitha','Laxmi','Murali','Nisha','Omkar','Padma','Qasim'
];
const LAST_NAMES = [
  'Sharma','Patel','Reddy','Kumar','Nair','Singh','Verma','Gupta','Rao',
  'Pillai','Joshi','Mehta','Iyer','Bhat','Naidu','Chowdary','Murthy',
  'Krishnan','Rajan','Hegde','Kulkarni','Desai','Shah','Jain','Pandey',
  'Mishra','Tiwari','Dubey','Srivastava','Chauhan','Thakur','Yadav','Goud',
  'Patil','More','Bhosale','Jadhav','Shinde','Kamble','Thorat','Pawar',
  'Subramaniam','Venkatesh','Balaji','Swamy','Raju','Babu','Prasad','Das',
  'Ghosh','Bose','Mukherjee','Chatterjee','Banerjee','Roy','Sen','Dey',
  'Thumma','Venkataramana','Lakshminarayana','Subrahmanyam','Ramakrishna',
  'Chandra','Kiran','Sagar','Mohan','Narayan','Srikanth','Bhaskara'
];

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function safeUsername(name, suffix) {
  return name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '').slice(0, 30) + '.' + suffix;
}
function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let p = 'SU@';
  for (let i = 0; i < 9; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

// ─── mark components builder ─────────────────────────────────────────────────
function makeComponents(internal, final_) {
  const ia1 = Math.round(internal * 0.4);
  const ia2 = Math.round(internal * 0.4);
  const ia3 = internal - ia1 - ia2;
  return JSON.stringify([
    { key: 'ia1',   label: 'Internal Assessment 1', max: ia1   },
    { key: 'ia2',   label: 'Internal Assessment 2', max: ia2   },
    { key: 'ia3',   label: 'Internal Assessment 3', max: ia3   },
    { key: 'final', label: 'Final Examination',      max: final_ },
  ]);
}

function randomMarks(internal) {
  const ia1 = Math.round(internal * 0.4);
  const ia2 = Math.round(internal * 0.4);
  const ia3 = internal - ia1 - ia2;
  return JSON.stringify({
    ia1:   rnd(Math.round(ia1 * 0.5), ia1),
    ia2:   rnd(Math.round(ia2 * 0.5), ia2),
    ia3:   rnd(Math.round(ia3 * 0.5), ia3),
    final: null,  // final exam not yet held
  });
}

// ─── department + course definitions ─────────────────────────────────────────
const DEPARTMENTS = [
  { key: 'CSE', name: 'Computer Science Engineering' },
  { key: 'CE',  name: 'Civil Engineering'            },
  { key: 'ME',  name: 'Mechanical Engineering'       },
];

const COURSES = {
  CSE: {
    '1-1': [
      { code: 'CSE101', name: 'Programming Fundamentals',   internal: 60, final: 40 },
      { code: 'CSE102', name: 'Engineering Mathematics I',  internal: 60, final: 40 },
      { code: 'CSE103', name: 'Digital Logic Design',       internal: 60, final: 40 },
      { code: 'CSE104', name: 'Computer Organization',      internal: 60, final: 40 },
      { code: 'CSE105', name: 'Communication Skills',       internal: 60, final: 40 },
    ],
    '2-1': [
      { code: 'CSE301', name: 'Web Technologies and Mobile Programming', internal: 60, final: 40 },
      { code: 'CSE302', name: 'Cloud Computing',                         internal: 60, final: 40 },
      { code: 'CSE303', name: 'AI Assisted Coding',                      internal: 60, final: 40 },
      { code: 'CSE304', name: 'Data Analytics and Visualization',        internal: 60, final: 40 },
      { code: 'CSE305', name: 'Information Management System',           internal: 60, final: 40 },
      { code: 'CSE306', name: 'Operating System and Computer Networks',  internal: 60, final: 40 },
    ],
    '3-1': [
      { code: 'CSE501', name: 'Software Engineering',        internal: 60, final: 40 },
      { code: 'CSE502', name: 'Database Management Systems', internal: 60, final: 40 },
      { code: 'CSE503', name: 'Computer Networks',           internal: 60, final: 40 },
      { code: 'CSE504', name: 'Operating Systems',           internal: 60, final: 40 },
      { code: 'CSE505', name: 'Theory of Computation',       internal: 60, final: 40 },
    ],
    '7-1': [
      { code: 'CSE701', name: 'Agentic AI',      internal: 60, final: 40 },
      { code: 'CSE702', name: 'Compiler Design', internal: 60, final: 40 },
      { code: 'CSE703', name: 'Blockchain',      internal: 60, final: 40 },
      { code: 'CSE704', name: 'Game Design',     internal: 60, final: 40 },
    ],
  },
  CE: {
    '1-1': [
      { code: 'CE101', name: 'Engineering Drawing',       internal: 60, final: 40 },
      { code: 'CE102', name: 'Engineering Mechanics',     internal: 60, final: 40 },
      { code: 'CE103', name: 'Engineering Chemistry',     internal: 60, final: 40 },
      { code: 'CE104', name: 'Engineering Mathematics I', internal: 60, final: 40 },
      { code: 'CE105', name: 'Environmental Science',     internal: 60, final: 40 },
    ],
    '2-1': [
      { code: 'CE301', name: 'Structural Analysis',     internal: 60, final: 40 },
      { code: 'CE302', name: 'Fluid Mechanics',         internal: 60, final: 40 },
      { code: 'CE303', name: 'Surveying and Geomatics', internal: 60, final: 40 },
      { code: 'CE304', name: 'Building Materials',      internal: 60, final: 40 },
      { code: 'CE305', name: 'Soil Mechanics',          internal: 60, final: 40 },
    ],
    '3-1': [
      { code: 'CE501', name: 'Foundation Engineering',    internal: 60, final: 40 },
      { code: 'CE502', name: 'Design of RC Structures',   internal: 60, final: 40 },
      { code: 'CE503', name: 'Transportation Engineering',internal: 60, final: 40 },
      { code: 'CE504', name: 'Hydrology',                 internal: 60, final: 40 },
      { code: 'CE505', name: 'Environmental Engineering', internal: 60, final: 40 },
    ],
    '7-1': [
      { code: 'CE701', name: 'Advanced Structural Design', internal: 60, final: 40 },
      { code: 'CE702', name: 'Construction Management',    internal: 60, final: 40 },
      { code: 'CE703', name: 'Smart Infrastructure',       internal: 60, final: 40 },
      { code: 'CE704', name: 'Disaster Management',        internal: 60, final: 40 },
    ],
  },
  ME: {
    '1-1': [
      { code: 'ME101', name: 'Engineering Mechanics',     internal: 60, final: 40 },
      { code: 'ME102', name: 'Thermodynamics',            internal: 60, final: 40 },
      { code: 'ME103', name: 'Engineering Drawing',       internal: 60, final: 40 },
      { code: 'ME104', name: 'Workshop Practice',         internal: 60, final: 40 },
      { code: 'ME105', name: 'Engineering Mathematics I', internal: 60, final: 40 },
    ],
    '2-1': [
      { code: 'ME301', name: 'Fluid Mechanics',         internal: 60, final: 40 },
      { code: 'ME302', name: 'Material Science',        internal: 60, final: 40 },
      { code: 'ME303', name: 'Manufacturing Processes', internal: 60, final: 40 },
      { code: 'ME304', name: 'Machine Drawing',         internal: 60, final: 40 },
      { code: 'ME305', name: 'Heat Transfer',           internal: 60, final: 40 },
    ],
    '3-1': [
      { code: 'ME501', name: 'Machine Design',           internal: 60, final: 40 },
      { code: 'ME502', name: 'Industrial Engineering',   internal: 60, final: 40 },
      { code: 'ME503', name: 'Robotics',                 internal: 60, final: 40 },
      { code: 'ME504', name: 'Power Systems',            internal: 60, final: 40 },
      { code: 'ME505', name: 'Dynamics of Machinery',   internal: 60, final: 40 },
    ],
    '7-1': [
      { code: 'ME701', name: 'Advanced Manufacturing',   internal: 60, final: 40 },
      { code: 'ME702', name: 'CAD/CAM',                  internal: 60, final: 40 },
      { code: 'ME703', name: 'Renewable Energy Systems', internal: 60, final: 40 },
      { code: 'ME704', name: 'Project Management',       internal: 60, final: 40 },
    ],
  },
};

// Year label → display semester label
const YEAR_DISPLAY = { '1-1': '1st Year', '2-1': '2nd Year', '3-1': '3rd Year', '7-1': '4th Year' };

// Exam timetables for specific CSE batches (your data)
const CSE_2_1_EXAMS = [
  { code: 'CSE301', date: '2026-11-30', room: '2002' },
  { code: 'CSE302', date: '2026-12-01', room: '2002' },
  { code: 'CSE303', date: '2026-12-02', room: '2002' },
  { code: 'CSE304', date: '2026-12-03', room: '2002' },
  { code: 'CSE305', date: '2026-12-04', room: '2002' },
  { code: 'CSE306', date: '2026-12-05', room: '2002' },
];
const CSE_4_1_EXAMS = [
  { code: 'CSE701', date: '2026-11-30', room: '2003' },
  { code: 'CSE702', date: '2026-12-01', room: '2003' },
  { code: 'CSE703', date: '2026-12-02', room: '2003' },
  { code: 'CSE704', date: '2026-12-03', room: '2003' },
];

// ─── MAIN SEED ────────────────────────────────────────────────────────────────
export async function seed() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Seeding is disabled in production.');

  await initDb();

  // Allow re-seeding if only admin exists
  const nonAdmin = (await db.query("SELECT id FROM users WHERE role != 'admin' LIMIT 1")).rows;
  if (nonAdmin.length)
    throw new Error('Non-admin users already exist. Clear them first from the admin panel before re-seeding.');

  console.log('🌱 Seeding Student University...');
  console.log(`   Attendance window: ${ATTEND_DAYS[0]} → ${ATTEND_DAYS[ATTEND_DAYS.length - 1]} (${ATTEND_DAYS.length} working days)\n`);

  const allCredentials = [];   // { role, name, username, password, department, year, batch }
  const DEFAULT_SLOT   = 1;   // attendance slot id 1 = Period 1 (08:30–09:30)

  // ── 1. Create departments ──────────────────────────────────────────────────
  const deptIds = {};
  for (const dept of DEPARTMENTS) {
    const did = uuid();
    deptIds[dept.key] = did;
    await q('INSERT INTO departments(id,name) VALUES($1,$2)', [did, dept.name]);
  }
  console.log('✅ Departments created: CSE, Civil Engineering, Mechanical Engineering');

  // ── 2. Seed each department ────────────────────────────────────────────────
  for (const dept of DEPARTMENTS) {
    const deptId   = deptIds[dept.key];
    const deptName = dept.name;
    const years    = Object.keys(COURSES[dept.key]);

    console.log(`\n📚 ${deptName}`);

    for (const sem of years) {
      const yearLabel   = YEAR_DISPLAY[sem] || sem;
      const courses     = COURSES[dept.key][sem];
      const batchPrefix = `${dept.key}-${sem}`;
      const NUM_BATCHES = 3;  // 3 batches per year

      // Special students: Thumma Vishal (CSE 4-1 Batch 1), Thumma Varun (CSE 2-1 Batch 1)
      const specialStudents = [];
      if (dept.key === 'CSE' && sem === '7-1') specialStudents.push({ batch: 0, slot: 0, name: 'Thumma Vishal' });
      if (dept.key === 'CSE' && sem === '2-1') specialStudents.push({ batch: 0, slot: 0, name: 'Thumma Varun'  });

      // Exam timetable
      const examDates = (dept.key === 'CSE' && sem === '2-1') ? CSE_2_1_EXAMS
                      : (dept.key === 'CSE' && sem === '7-1') ? CSE_4_1_EXAMS
                      : null;

      console.log(`   ${yearLabel} (${sem}) — ${courses.length} courses, ${NUM_BATCHES} batches`);

      // Create courses (shared across batches of this year/dept)
      const courseIds = {}; // code → uuid
      for (const c of courses) {
        const cid = uuid();
        courseIds[c.code] = cid;
        await q(
          'INSERT INTO courses(id,code,name,staff_id,semester,components) VALUES($1,$2,$3,$4,$5,$6)',
          [cid, c.code, c.name, null, sem, makeComponents(c.internal, c.final)]
        );
      }

      // Exam timetable entries (one per course, shared across all batches of this year)
      if (examDates) {
        for (const exam of examDates) {
          if (!courseIds[exam.code]) continue;
          await q(
            `INSERT INTO timetable(id,course_id,batch_id,exam_type,date,start_time,end_time,time,room)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [uuid(), courseIds[exam.code], null, 'End Semester Exam',
             exam.date, '10:00', '12:00', '10:00–12:00', exam.room]
          );
        }
      }

      // ── batches ────────────────────────────────────────────────────────────
      for (let b = 0; b < NUM_BATCHES; b++) {
        const batchName = `${batchPrefix}-B${b + 1}`;
        const batchId   = uuid();
        await q(
          'INSERT INTO batches(id,name,department_id,semester) VALUES($1,$2,$3,$4)',
          [batchId, batchName, deptId, sem]
        );

        // ── staff: one per course in this batch ───────────────────────────
        for (const c of courses) {
          const staffName = randomName();
          const staffId   = uuid();
          const uname     = safeUsername('dr.' + staffName, `${dept.key.toLowerCase()}.${c.code.toLowerCase()}.b${b+1}`);
          const pwd       = randomPassword();
          await q(
            'INSERT INTO users(id,username,name,role,password_hash,department,semester,batch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [staffId, uname, `Dr. ${staffName}`, 'staff', await hashPassword(pwd), deptName, sem, null]
          );
          await q(
            'INSERT INTO course_assignments(id,course_id,batch_id,staff_id) VALUES($1,$2,$3,$4)',
            [uuid(), courseIds[c.code], batchId, staffId]
          );
          allCredentials.push({
            role: 'staff', name: `Dr. ${staffName}`, username: uname, password: pwd,
            department: deptName, year: yearLabel, batch: batchName, course: c.name,
          });
        }

        // ── students: 30 per batch ────────────────────────────────────────
        const studentIds = [];
        for (let s = 0; s < 30; s++) {
          const special = specialStudents.find(sp => sp.batch === b && sp.slot === s);
          const sName   = special ? special.name : randomName();
          const sid     = uuid();
          const suffix  = `${dept.key.toLowerCase()}${sem.replace('-','')}b${b+1}s${s+1}`;
          const uname   = safeUsername(sName, suffix);
          const pwd     = randomPassword();
          await q(
            'INSERT INTO users(id,username,name,role,password_hash,department,semester,batch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [sid, uname, sName, 'student', await hashPassword(pwd), deptName, sem, batchId]
          );
          studentIds.push({ id: sid, name: sName });
          allCredentials.push({
            role: 'student', name: sName, username: uname, password: pwd,
            department: deptName, year: yearLabel, batch: batchName, course: '',
          });

          // enroll + marks
          for (const c of courses) {
            await q(
              'INSERT INTO enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
              [sid, courseIds[c.code]]
            );
            await q(
              'INSERT INTO marks(student_id,course_id,values_json) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
              [sid, courseIds[c.code], randomMarks(c.internal)]
            );
          }
        }

        // ── attendance: 3 months weekdays (Mon–Fri), skip Sat/Sun ─────────
        for (const { id: sid } of studentIds) {
          const bias = 0.65 + Math.random() * 0.3;  // each student 65–95% present
          for (const day of ATTEND_DAYS) {
            for (const c of courses) {
              await q(
                `INSERT INTO attendance(student_id,course_id,date,slot,present,start_time,end_time)
                 VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
                [sid, courseIds[c.code], day, DEFAULT_SLOT, Math.random() < bias, '08:30', '09:30']
              );
            }
          }
        }

        process.stdout.write(`     ${batchName}: 30 students, ${courses.length} courses ✓\n`);
      } // end batches
    } // end years
  } // end departments

  // ── 3. Campus notices ──────────────────────────────────────────────────────
  const notices = [
    ['Welcome to Student University 2026-27', 'General',
     'Welcome to the academic year 2026-27! All students must complete their profiles in the portal. This portal gives real-time access to your attendance, marks, timetable, and campus updates.'],
    ['End Semester Examination Schedule', 'Exam',
     'End semester examinations begin November 30, 2026. Check your timetable in the portal for subject-wise schedule, time and room details. Hall tickets will be issued through the department office.'],
    ['Attendance Policy Reminder', 'Academic',
     'Minimum 75% attendance is mandatory to appear for end semester examinations. Students below 75% may be detained. Check your attendance report regularly in the Student Portal.'],
    ['Faculty Feedback Open', 'Academic',
     'Students can now submit feedback for all enrolled courses. Your feedback helps improve teaching quality. Feedback is confidential and can be submitted once per course.'],
    ['AI Study Assistant Available', 'General',
     'The Student Portal features an AI-powered study assistant. Ask questions about your subjects, request short notes, check your attendance, or get YouTube and free study resource links. Access it from your Student Portal.'],
    ['Library Extended Hours', 'General',
     'The university library will remain open from 8:00 AM to 10:00 PM during the examination period (Nov 30 – Dec 15, 2026). Digital resources are available 24/7 through the library portal.'],
  ];
  for (const [title, type, body] of notices) {
    await q('INSERT INTO notices(id,title,type,body,date) VALUES($1,$2,$3,$4,$5)',
            [uuid(), title, type, body, '2026-11-22']);
  }

  // ── 4. Campus events ───────────────────────────────────────────────────────
  const events = [
    ['End Semester Exams 2026',
     'End semester examinations for all departments. Report to your examination hall 15 minutes early with your hall ticket and ID card.',
     '2026-11-30', '2026-12-15'],
    ['Annual Tech Fest — TechVista 2026',
     'Annual inter-college technology festival. Competitions in coding, robotics, hackathon, AI, and more. Register at the student services counter.',
     '2026-12-18', '2026-12-20'],
    ['Winter Break',
     'University closed for winter break. Classes resume January 6, 2027.',
     '2026-12-22', '2027-01-05'],
  ];
  for (const [title, body, start, end] of events) {
    await q('INSERT INTO events(id,title,body,start_date,end_date,active) VALUES($1,$2,$3,$4,$5,$6)',
            [uuid(), title, body, start, end, true]);
  }

  // ── 5. Write all credentials to file ──────────────────────────────────────
  const lines = [
    '='.repeat(80),
    'STUDENT UNIVERSITY — ALL USER CREDENTIALS',
    'Generated: ' + new Date().toISOString(),
    'WARNING: Keep this file private. Do not commit to GitHub.',
    '='.repeat(80),
    '',
    '── ADMIN ──────────────────────────────────────────────────────────────────',
    '  Username : (set via BOOTSTRAP_ADMIN_USERNAME env var, default: administrator)',
    '  Password : (set via BOOTSTRAP_ADMIN_PASSWORD env var)',
    '  Role     : admin',
    '',
  ];

  // Group by role then department/year/batch
  const staffCreds   = allCredentials.filter(c => c.role === 'staff');
  const studentCreds = allCredentials.filter(c => c.role === 'student');

  lines.push('── STAFF / PROFESSORS ──────────────────────────────────────────────────────');
  lines.push(`Total staff: ${staffCreds.length}`);
  lines.push('');

  let lastDept = '', lastBatch = '';
  for (const c of staffCreds) {
    if (c.department !== lastDept) { lines.push(`  Department: ${c.department}`); lastDept = c.department; lastBatch = ''; }
    if (c.batch     !== lastBatch) { lines.push(`    Batch: ${c.batch} (${c.year})`); lastBatch = c.batch; }
    lines.push(`      Course : ${c.course}`);
    lines.push(`      Name   : ${c.name}`);
    lines.push(`      Username: ${c.username}`);
    lines.push(`      Password: ${c.password}`);
    lines.push('');
  }

  lines.push('── STUDENTS ────────────────────────────────────────────────────────────────');
  lines.push(`Total students: ${studentCreds.length}`);
  lines.push('');

  lastDept = ''; lastBatch = '';
  for (const c of studentCreds) {
    if (c.department !== lastDept) { lines.push(`  Department: ${c.department}`); lastDept = c.department; lastBatch = ''; }
    if (c.batch     !== lastBatch) { lines.push(`    Batch: ${c.batch} (${c.year})`); lastBatch = c.batch; }
    lines.push(`      ${c.name.padEnd(28)} | ${c.username.padEnd(45)} | ${c.password}`);
  }

  lines.push('');
  lines.push('='.repeat(80));

  const credFile = 'ALL-CREDENTIALS.txt';
  await writeFile(credFile, lines.join('\n'));

  // Summary
  const totalStudents = studentCreds.length;
  const totalStaff    = staffCreds.length;
  console.log('\n' + '='.repeat(60));
  console.log('✅ SEED COMPLETE');
  console.log(`   Students : ${totalStudents}`);
  console.log(`   Staff    : ${totalStaff}`);
  console.log(`   Attendance records : ~${(totalStudents * ATTEND_DAYS.length * 5).toLocaleString()} rows`);
  console.log(`   Credentials saved  : ${credFile}`);
  console.log('='.repeat(60));
  console.log('\nNext step: run  npm run bootstrap:admin  to create the admin account.\n');

  return { totalStudents, totalStaff };
}

// ─── entry point ─────────────────────────────────────────────────────────────
export default seed;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await seed();
  } catch (e) {
    console.error('\n❌ Seed failed:', e.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}
