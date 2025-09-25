
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
  });

  it("should prevent course creation when no instructor profile exists", () => {
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
    
    expect(result).toBeErr(Cl.uint(103)); // err-unauthorized - no instructor profile
  });

  it("should fail to update progress for non-existent enrollment", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "update-progress",
      [Cl.uint(1), Cl.uint(75)], // 75% complete
      wallet3
    );

    expect(result).toBeErr(Cl.uint(101)); // err-not-found
  });

  it("should fail to generate certificate for non-existent enrollment", () => {
    const { result } = simnet.callPublicFn(
      "elearn",
      "generate-certificate",
      [Cl.uint(1), Cl.stringAscii("QmCertHash123...")],
      wallet3
    );

    expect(result).toBeErr(Cl.uint(101)); // err-not-found
  });

  it("should return none for non-existent course", () => {
    const course = simnet.callReadOnlyFn(
      "elearn",
      "get-course",
      [Cl.uint(999)], // Non-existent course
      wallet1
    );
    
    expect(course.result).toBeNone();
  });

  it("should return none for non-existent enrollment", () => {
    const enrollment = simnet.callReadOnlyFn(
      "elearn",
      "get-enrollment",
      [Cl.principal(wallet2), Cl.uint(999)], // Non-existent enrollment
      wallet2
    );

    expect(enrollment.result).toBeNone();
  });

  it("should return none for non-existent instructor", () => {
    const instructor = simnet.callReadOnlyFn(
      "elearn",
      "get-instructor",
      [Cl.principal(wallet2)], // Non-existent instructor
      wallet2
    );

    expect(instructor.result).toBeNone();
  });
});

