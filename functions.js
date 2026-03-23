/* functions.js - Advanced Multi-Part Calculations */
import { db, storage } from './firebase.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

// Mapping Rule
function getGrade(marks) {
  if (marks >= 75) return 'A';
  if (marks >= 65) return 'B';
  if (marks >= 55) return 'C';
  if (marks >= 45) return 'S';
  return 'W';
}

export async function uploadMaterialFile(file) {
  try {
    const storageRef = ref(storage, `materials/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (e) { throw e; }
}
export async function addMaterial(materialData) {
  await addDoc(collection(db, "materials"), { ...materialData, createdAt: serverTimestamp() });
}
export async function getMaterials() {
  const snapshot = await getDocs(query(collection(db, "materials"), orderBy("createdAt", "desc")));
  const materials = [];
  snapshot.forEach(doc => materials.push({ id: doc.id, ...doc.data() }));
  return materials;
}

// EXAMS
export async function addExam(examData) {
  await addDoc(collection(db, "exams"), { ...examData, createdAt: serverTimestamp() });
}
export async function getExams() {
  const snapshot = await getDocs(query(collection(db, "exams"), orderBy("date", "desc")));
  const exams = [];
  snapshot.forEach(doc => exams.push({ id: doc.id, ...doc.data() }));
  return exams;
}
export async function deleteExam(docId) {
  await deleteDoc(doc(db, "exams", docId));
}

// STUDENTS
export async function addStudent(studentData) {
  await addDoc(collection(db, "students"), { ...studentData, hasNewResult: false, createdAt: serverTimestamp() });
}
export async function deleteStudent(docId) {
  const student = await getDocs(query(collection(db, "students"), where("__name__", "==", docId)));
  if (!student.empty) {
     const sid = student.docs[0].data().studentId;
     const results = await getDocs(query(collection(db, "results"), where("studentId", "==", sid)));
     results.forEach(async r => await deleteDoc(doc(db, "results", r.id)));
  }
  await deleteDoc(doc(db, "students", docId));
}
export async function updateStudent(docId, updateData) {
  await updateDoc(doc(db, "students", docId), updateData);
}
export async function getStudent(studentId) {
  const q = query(collection(db, "students"), where("studentId", "==", studentId));
  const snapshot = await getDocs(q);
  return !snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null;
}

// RESULTS - Now supports part-wise logging
export async function addResult(resultData) {
  await addDoc(collection(db, "results"), { 
    ...resultData, 
    isReleased: false, 
    grade: '-', rank: '-', classAverage: '-',
    createdAt: serverTimestamp() 
  });
}

// AGGREGATION ENGINE
export async function releaseAllAndCalculate() {
  const allResultsSnapshot = await getDocs(collection(db, "results"));
  const allResults = [];
  allResultsSnapshot.forEach(doc => allResults.push({ id: doc.id, ...doc.data() }));

  // Group by Exam Name (e.g. Pure Math) AND Student
  const studentExamMap = {};
  allResults.forEach(r => {
    const key = `${r.examName}_${r.studentId}`;
    if (!studentExamMap[key]) studentExamMap[key] = { items: [], total: 0 };
    studentExamMap[key].items.push(r);
  });

  // Calculate Final Aggregates
  const aggregatedResults = [];
  for (const key in studentExamMap) {
    const group = studentExamMap[key];
    const examName = group.items[0].examName;
    const studentId = group.items[0].studentId;
    
    // Group logic: Part 1 (A+B) + Part 2 (A+B) / 2
    let p1Sum = 0; let p2Sum = 0;
    group.items.forEach(item => {
      if (item.paperPart === 'Part 1') p1Sum += parseFloat(item.marks);
      else if (item.paperPart === 'Part 2') p2Sum += parseFloat(item.marks);
      else p1Sum += parseFloat(item.marks); // Treat "Full Paper" as P1 if logged alone
    });

    const finalMarks = (p1Sum + p2Sum) / (p2Sum > 0 ? 2 : 1); // Simple fallback
    aggregatedResults.push({ studentId, examName, marks: finalMarks, sourceIds: group.items.map(i => i.id) });
  }

  // Calculate Ranks & Averages for the Final Figures
  const examGroups = {};
  aggregatedResults.forEach(r => {
    if (!examGroups[r.examName]) examGroups[r.examName] = [];
    examGroups[r.examName].push(r);
  });

  let updateCount = 0;
  for (const examName in examGroups) {
    const results = examGroups[examName];
    const avg = (results.reduce((s, r) => s + r.marks, 0) / results.length).toFixed(1);
    const sorted = [...results].sort((a,b) => b.marks - a.marks);

    for (const r of sorted) {
      const rank = sorted.findIndex(sr => sr.marks === r.marks) + 1;
      const grade = getGrade(r.marks);
      
      // Update all source documents with these final stats
      for (const docId of r.sourceIds) {
        await updateDoc(doc(db, "results", docId), { 
           grade, rank, classAverage: avg, isReleased: true, finalAggregate: r.marks 
        });
        updateCount++;
      }

      // Mark student for notification
      const sq = query(collection(db, "students"), where("studentId", "==", r.studentId));
      const ss = await getDocs(sq);
      if (!ss.empty) await updateDoc(doc(db, "students", ss.docs[0].id), { hasNewResult: true });
    }
  }
  return updateCount;
}

export async function getStudentResults(studentId) {
  const q = query(collection(db, "results"), where("studentId", "==", studentId), where("isReleased", "==", true));
  const snapshot = await getDocs(q);
  const results = [];
  snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
  // Sort by date then deduplicate to show only the aggregated outcome if needed, 
  // but here we return all to let UI decide.
  return results.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}
