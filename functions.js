/* functions.js - Advanced Multi-Part Calculations & Secure Admin Access */
import { db, storage, auth } from './firebase.js';
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
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// AUTH OPERATIONS
export async function loginAdmin(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        throw error;
    }
}

export async function logoutAdmin() {
    await signOut(auth);
}

export function subscribeToAuth(callback) {
    return onAuthStateChanged(auth, callback);
}

// Mapping Rule
function getGrade(marks) {
  if (marks >= 75) return 'A';
  if (marks >= 65) return 'B';
  if (marks >= 55) return 'C';
  if (marks >= 40) return 'S';
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
export async function updateExam(docId, updateData) {
  await updateDoc(doc(db, "exams", docId), updateData);
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

  // Group by specific Exam ID and Batch (Class) to ensure total isolation
  // This prevents previous exams or other classes from affecting the current ranking
  const groups = {};
  allResults.forEach(r => {
    // Use examId + batch as the unique grouping key. Fallback to examName for legacy data.
    const gid = `${r.examId || r.examName}_${r.batch || 'Unassigned'}`;
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(r);
  });

  let updateCount = 0;
  for (const gid in groups) {
    const results = groups[gid];
    if (results.length === 0) continue;

    // Calculate class average for this specific exam instance and batch
    const totalMarks = results.reduce((s, r) => s + (parseFloat(r.marks) || 0), 0);
    const avg = (totalMarks / results.length).toFixed(1);
    
    // Sort by marks descending for ranking
    const sorted = [...results].sort((a,b) => (parseFloat(b.marks) || 0) - (parseFloat(a.marks) || 0));

    for (const r of sorted) {
      // Find rank (handling ties: students with same marks get the same rank)
      const rank = sorted.findIndex(sr => parseFloat(sr.marks) === parseFloat(r.marks)) + 1;
      
      // Calculate grade based on percentage (multiply by 2 if it's a part usually out of 50)
      const isPart = (r.paperPart !== 'Full Paper' || r.subSection !== 'None');
      const percentageMarks = isPart ? r.marks * 2 : r.marks;
      const grade = getGrade(percentageMarks);
      
      // Update the result document with its isolated stats
      await updateDoc(doc(db, "results", r.id), { 
         grade, 
         rank, 
         classAverage: avg, 
         isReleased: true,
         // Store marks as finalAggregate to maintain compatibility with student portal
         finalAggregate: r.marks 
      });
      updateCount++;

      // Mark student for notification
      const sq = query(collection(db, "students"), where("studentId", "==", r.studentId));
      const ss = await getDocs(sq);
      if (!ss.empty) {
        await updateDoc(doc(db, "students", ss.docs[0].id), { hasNewResult: true });
      }
    }
  }
  return updateCount;
}

export async function rerankGroup(examId, batch) {
  const q = query(
    collection(db, "results"), 
    where("examId", "==", examId), 
    where("batch", "==", batch)
  );
  const snap = await getDocs(q);
  const results = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (data.isReleased) results.push({ id: doc.id, ...data });
  });

  if (results.length === 0) return 0;

  const totalMarks = results.reduce((s, r) => s + (parseFloat(r.marks) || 0), 0);
  const avg = (totalMarks / results.length).toFixed(1);
  const sorted = [...results].sort((a,b) => (parseFloat(b.marks) || 0) - (parseFloat(a.marks) || 0));

  for (const r of sorted) {
    const rank = sorted.findIndex(sr => parseFloat(sr.marks) === parseFloat(r.marks)) + 1;
    const isPart = (r.paperPart !== 'Full Paper' || r.subSection !== 'None');
    const grade = getGrade(isPart ? r.marks * 2 : r.marks);
    await updateDoc(doc(db, "results", r.id), { grade, rank, classAverage: avg });
  }
  return results.length;
}

export async function deleteResult(docId) {
  await deleteDoc(doc(db, "results", docId));
}

export async function unpublishResult(docId) {
  await updateDoc(doc(db, "results", docId), { isReleased: false });
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
