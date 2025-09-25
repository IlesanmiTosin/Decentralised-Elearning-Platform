
import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("Elearn Contract - Basic Setup and Initialization", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  it("ensures simnet is well initialised", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  it("should have correct initial values for data variables", () => {
    const nextCourseId = simnet.getDataVar("elearn", "next-course-id");
    expect(nextCourseId).toBeUint(1);

    const nextPostId = simnet.getDataVar("elearn", "next-post-id");
    expect(nextPostId).toBeUint(1);

    const platformFee = simnet.getDataVar("elearn", "platform-fee-percentage");
    expect(platformFee).toBeUint(5);
  });

  it("should create student profile successfully", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("John Doe")],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));

    const profile = simnet.callReadOnlyFn(
      "elearn",
      "get-student-profile",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect(profile.result).toBeSome(Cl.tuple({
      "name": Cl.stringAscii("John Doe"),
      "completed-courses": Cl.uint(0),
      "total-spent": Cl.uint(0),
      "achievements": Cl.list([]),
      "joined-at": Cl.uint(simnet.blockHeight),
      "preferences": Cl.list([])
    }));
  });

  it("should prevent duplicate student profile creation", () => {
    simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("John Doe")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("John Doe Again")],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(102)); // err-already-exists
  });

  it("should update student preferences successfully", () => {
    simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("Jane Doe")],
      wallet2
    );

    const preferences = Cl.list([
      Cl.stringAscii("programming"),
      Cl.stringAscii("blockchain")
    ]);

    const { result } = simnet.callPublicFn(
      "elearn",
      "update-student-preferences",
      [preferences],
      wallet2
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("should fail to update preferences for non-existent profile", () => {
    const preferences = Cl.list([Cl.stringAscii("programming")]);

    const { result } = simnet.callPublicFn(
      "elearn",
      "update-student-preferences",
      [preferences],
      wallet3
    );
    expect(result).toBeErr(Cl.uint(101)); // err-not-found
  });

  it("should allow owner to set platform fee", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "set-platform-fee",
      [Cl.uint(10)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const platformFee = simnet.getDataVar("elearn", "platform-fee-percentage");
    expect(platformFee).toBeUint(10);
  });

  it("should prevent non-owner from setting platform fee", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "set-platform-fee",
      [Cl.uint(15)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(103)); // err-unauthorized
  });

  it("should prevent setting platform fee above 100%", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "set-platform-fee",
      [Cl.uint(101)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(103)); // err-unauthorized
  });
});

describe("Elearn Contract - Course Management", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
    
    // Setup instructor profile
    simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("Instructor One")],
      wallet1
    );
    
    // Create instructor details (this should be added to the contract if missing)
    const instructorDetails = {
      name: Cl.stringAscii("Dr. Jane Smith"),
      credentials: Cl.stringAscii("PhD in Computer Science, 10 years teaching"),
      rating: Cl.uint(95),
      totalReviews: Cl.uint(150),
      totalStudents: Cl.uint(500),
      totalEarnings: Cl.uint(0),
      bio: Cl.stringAscii("Expert in blockchain and distributed systems"),
      socialLinks: Cl.list([Cl.stringAscii("https://linkedin.com/in/janesmith")])
    };
    
    simnet.callPublicFn(
      "elearn",
      "create-instructor-profile",
      [
        instructorDetails.name,
        instructorDetails.credentials,
        instructorDetails.bio,
        instructorDetails.socialLinks
      ],
      wallet1
    );
  });

  it("should create a course successfully", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "create-course",
      [
        Cl.stringAscii("Introduction to Blockchain"),
        Cl.uint(1000000), // 1 STX in micro-STX
        Cl.stringAscii("QmHash123..."), // IPFS hash
        Cl.stringAscii("Technology"),
        Cl.stringAscii("Learn the fundamentals of blockchain technology"),
        Cl.list([]) // No prerequisites
      ],
      wallet1
    );
    
    expect(result).toBeOk(Cl.uint(1)); // First course ID

    // Verify course was created
    const course = simnet.callReadOnlyFn(
      "elearn",
      "get-course",
      [Cl.uint(1)],
      wallet1
    );
    
    expect(course.result).toBeSome(Cl.tuple({
      "title": Cl.stringAscii("Introduction to Blockchain"),
      "instructor": Cl.principal(wallet1),
      "price": Cl.uint(1000000),
      "content-hash": Cl.stringAscii("QmHash123..."),
      "is-active": Cl.bool(true),
      "category": Cl.stringAscii("Technology"),
      "description": Cl.stringAscii("Learn the fundamentals of blockchain technology"),
      "total-students": Cl.uint(0),
      "average-rating": Cl.uint(0),
      "total-ratings": Cl.uint(0),
      "prerequisites": Cl.list([]),
      "created-at": Cl.uint(simnet.blockHeight)
    }));
  });

  it("should prevent non-instructor from creating course", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "create-course",
      [
        Cl.stringAscii("Unauthorized Course"),
        Cl.uint(500000),
        Cl.stringAscii("QmHash456..."),
        Cl.stringAscii("Technology"),
        Cl.stringAscii("This should fail"),
        Cl.list([])
      ],
      wallet2 // No instructor profile
    );
    
    expect(result).toBeErr(Cl.uint(103)); // err-unauthorized
  });

  it("should allow student enrollment in active course", () => {
    // Create course first
    simnet.callPublicFn(
      "elearn",
      "create-course",
      [
        Cl.stringAscii("Web Development"),
        Cl.uint(800000),
        Cl.stringAscii("QmHash789..."),
        Cl.stringAscii("Programming"),
        Cl.stringAscii("Learn modern web development"),
        Cl.list([])
      ],
      wallet1
    );

    // Create student profile
    simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("Student Bob")],
      wallet2
    );

    // Enroll in course (this function needs to be added to contract)
    const { result } = simnet.callPublicFn(
      "elearn",
      "enroll-in-course",
      [Cl.uint(1)],
      wallet2
    );

    expect(result).toBeOk(Cl.bool(true));

    // Verify enrollment
    const enrollment = simnet.callReadOnlyFn(
      "elearn",
      "get-enrollment",
      [Cl.principal(wallet2), Cl.uint(1)],
      wallet2
    );

    expect(enrollment.result).toBeSome(Cl.tuple({
      "enrolled-at": Cl.uint(simnet.blockHeight),
      "completed": Cl.bool(false),
      "rating": Cl.none(),
      "progress": Cl.uint(0),
      "last-accessed": Cl.uint(simnet.blockHeight),
      "completion-certificate": Cl.none()
    }));
  });

  it("should update course progress successfully", () => {
    // Setup: Create course and enroll student
    simnet.callPublicFn(
      "elearn",
      "create-course",
      [
        Cl.stringAscii("Data Structures"),
        Cl.uint(1200000),
        Cl.stringAscii("QmHashABC..."),
        Cl.stringAscii("Computer Science"),
        Cl.stringAscii("Master data structures and algorithms"),
        Cl.list([])
      ],
      wallet1
    );

    simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("Student Alice")],
      wallet3
    );

    simnet.callPublicFn(
      "elearn",
      "enroll-in-course",
      [Cl.uint(1)],
      wallet3
    );

    // Update progress
    const { result } = simnet.callPublicFn(
      "elearn",
      "update-progress",
      [Cl.uint(1), Cl.uint(75)], // 75% complete
      wallet3
    );

    expect(result).toBeOk(Cl.bool(true));

    // Verify progress was updated
    const enrollment = simnet.callReadOnlyFn(
      "elearn",
      "get-enrollment",
      [Cl.principal(wallet3), Cl.uint(1)],
      wallet3
    );

    expect(enrollment.result).toBeSome(Cl.tuple({
      "enrolled-at": Cl.uint(simnet.blockHeight),
      "completed": Cl.bool(false),
      "rating": Cl.none(),
      "progress": Cl.uint(75),
      "last-accessed": Cl.uint(simnet.blockHeight),
      "completion-certificate": Cl.none()
    }));
  });

  it("should complete course and generate certificate", () => {
    // Setup course and enrollment
    simnet.callPublicFn(
      "elearn",
      "create-course",
      [
        Cl.stringAscii("Smart Contracts"),
        Cl.uint(1500000),
        Cl.stringAscii("QmHashDEF..."),
        Cl.stringAscii("Blockchain"),
        Cl.stringAscii("Build smart contracts on Stacks"),
        Cl.list([])
      ],
      wallet1
    );

    simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("Student Charlie")],
      wallet3
    );

    simnet.callPublicFn(
      "elearn",
      "enroll-in-course",
      [Cl.uint(1)],
      wallet3
    );

    // Complete course (this function needs to be added)
    const completeResult = simnet.callPublicFn(
      "elearn",
      "complete-course",
      [Cl.uint(1)],
      wallet3
    );

    expect(completeResult.result).toBeOk(Cl.bool(true));

    // Generate certificate
    const { result } = simnet.callPublicFn(
      "elearn",
      "generate-certificate",
      [Cl.uint(1), Cl.stringAscii("QmCertHash123...")],
      wallet3
    );

    expect(result).toBeOk(Cl.bool(true));
  });

  it("should fail to generate certificate for incomplete course", () => {
    // Setup course and enrollment without completion
    simnet.callPublicFn(
      "elearn",
      "create-course",
      [
        Cl.stringAscii("Advanced Blockchain"),
        Cl.uint(2000000),
        Cl.stringAscii("QmHashGHI..."),
        Cl.stringAscii("Blockchain"),
        Cl.stringAscii("Advanced blockchain concepts"),
        Cl.list([])
      ],
      wallet1
    );

    simnet.callPublicFn(
      "elearn",
      "create-student-profile",
      [Cl.stringAscii("Student David")],
      wallet2
    );

    simnet.callPublicFn(
      "elearn",
      "enroll-in-course",
      [Cl.uint(1)],
      wallet2
    );

    // Try to generate certificate without completion
    const { result } = simnet.callPublicFn(
      "elearn",
      "generate-certificate",
      [Cl.uint(1), Cl.stringAscii("QmCertHash456...")],
      wallet2
    );

    expect(result).toBeErr(Cl.uint(103)); // err-unauthorized
  });
});

