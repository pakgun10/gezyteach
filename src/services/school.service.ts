import { db } from "../db";
import { schoolProfiles } from "../db/schema";

const SCHOOL_PROFILE_ID = 1;

export type SchoolProfileInput = {
  schoolName?: string;
  address?: string;
  city?: string;
  principalName?: string;
  principalNip?: string;
  defaultAcademicYear?: string;
  defaultSemester: "1" | "2";
};

function emptySchoolProfile(): typeof schoolProfiles.$inferSelect {
  return {
    id: SCHOOL_PROFILE_ID,
    schoolName: null,
    address: null,
    city: null,
    principalName: null,
    principalNip: null,
    defaultAcademicYear: null,
    defaultSemester: "1",
    createdAt: 0,
    updatedAt: 0,
  };
}

export async function getSchoolProfile() {
  const existing = await db.query.schoolProfiles.findFirst({
    where: (profile, { eq: eqFn }) => eqFn(profile.id, SCHOOL_PROFILE_ID),
  });
  return existing ?? emptySchoolProfile();
}

export async function updateSchoolProfile(data: SchoolProfileInput) {
  const values = {
    schoolName: data.schoolName?.trim() || null,
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    principalName: data.principalName?.trim() || null,
    principalNip: data.principalNip?.trim() || null,
    defaultAcademicYear: data.defaultAcademicYear?.trim() || null,
    defaultSemester: data.defaultSemester === "2" ? "2" : "1",
    updatedAt: Date.now(),
  } as const;

  await db
    .insert(schoolProfiles)
    .values({ id: SCHOOL_PROFILE_ID, ...values })
    .onConflictDoUpdate({
      target: [schoolProfiles.id],
      set: values,
    });

  return db.query.schoolProfiles.findFirst({
    where: (profile, { eq: eqFn }) => eqFn(profile.id, SCHOOL_PROFILE_ID),
  });
}
