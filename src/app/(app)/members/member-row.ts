// Shared by the server pages and the client form.
export type MemberRow = {
  id?: number | null;
  key: string;
  firstName: string;
  fatherName: string;
  surname: string;
  relation: string;
  gender: string;
  dob: string;
  mobile: string;
  email: string;
  bloodGroup: string;
  education: string;
  occupation: string;
  maritalStatus: string;
  pan: string;
  isAlive: boolean;
};

let seq = 0;
export const newKey = () => `n${Date.now()}_${seq++}`;

export function emptyMember(surname = "", relation = "સ્વયં"): MemberRow {
  return {
    key: newKey(), firstName: "", fatherName: "", surname, relation, gender: "", dob: "", mobile: "", email: "",
    bloodGroup: "", education: "", occupation: "", maritalStatus: "", pan: "", isAlive: true,
  };
}
