;; Decentralized E-Learning Platform

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-unauthorized (err u103))
(define-constant err-invalid-input (err u104))
(define-constant err-course-inactive (err u105))
(define-constant err-insufficient-balance (err u106))

;; Data Variables
(define-data-var next-course-id uint u1)
(define-data-var next-post-id uint u1)
(define-data-var platform-fee-percentage uint u5) ;; 5% platform fee

;; Data Maps
(define-map courses
    { course-id: uint }
    {
        title: (string-ascii 100),
        instructor: principal,
        price: uint,
        content-hash: (string-ascii 64),
        is-active: bool,
        category: (string-ascii 50),
        description: (string-ascii 500),
        total-students: uint,
        average-rating: uint,
        total-ratings: uint,
        prerequisites: (list 10 uint),
        created-at: uint,
    }
)

(define-map instructor-details
    { instructor: principal }
    {
        name: (string-ascii 50),
        credentials: (string-ascii 200),
        rating: uint,
        total-reviews: uint,
        total-students: uint,
        total-earnings: uint,
        bio: (string-ascii 500),
        social-links: (list 5 (string-ascii 200)),
    }
)

(define-map enrollments
    {
        student: principal,
        course-id: uint,
    }
    {
        enrolled-at: uint,
        completed: bool,
        rating: (optional uint),
        progress: uint,
        last-accessed: uint,
        completion-certificate: (optional (string-ascii 64)),
    }
)

(define-map student-profiles
    { student: principal }
    {
        name: (string-ascii 50),
        completed-courses: uint,
        total-spent: uint,
        achievements: (list 10 (string-ascii 50)),
        joined-at: uint,
        preferences: (list 5 (string-ascii 50)),
    }
)

(define-map course-discussions
    {
        course-id: uint,
        post-id: uint,
    }
    {
        author: principal,
        content: (string-ascii 500),
        timestamp: uint,
        replies: (list 10 uint),
        upvotes: uint,
    }
)

;; Read-only functions
(define-read-only (get-course (course-id uint))
    (map-get? courses { course-id: course-id })
)

(define-read-only (get-instructor (instructor principal))
    (map-get? instructor-details { instructor: instructor })
)

(define-read-only (get-enrollment
        (student principal)
        (course-id uint)
    )
    (map-get? enrollments {
        student: student,
        course-id: course-id,
    })
)

(define-read-only (get-student-profile (student principal))
    (map-get? student-profiles { student: student })
)

(define-read-only (get-discussion-post
        (course-id uint)
        (post-id uint)
    )
    (map-get? course-discussions {
        course-id: course-id,
        post-id: post-id,
    })
)

;; Public functions

;; Student Profile Management
(define-public (create-student-profile (name (string-ascii 50)))
    (let ((existing-profile (get-student-profile tx-sender)))
        (if (is-some existing-profile)
            err-already-exists
            (ok (map-set student-profiles { student: tx-sender } {
                name: name,
                completed-courses: u0,
                total-spent: u0,
                achievements: (list),
                joined-at: stacks-block-height,
                preferences: (list),
            }))
        )
    )
)

(define-public (update-student-preferences (preferences (list 5 (string-ascii 50))))
    (let ((profile (get-student-profile tx-sender)))
        (match profile
            profile-data (ok (map-set student-profiles { student: tx-sender }
                (merge profile-data { preferences: preferences })
            ))
            err-not-found
        )
    )
)

;; Course Progress Tracking
(define-public (update-progress
        (course-id uint)
        (progress uint)
    )
    (let ((enrollment (get-enrollment tx-sender course-id)))
        (match enrollment
            enrollment-data (ok (map-set enrollments {
                student: tx-sender,
                course-id: course-id,
            }
                (merge enrollment-data {
                    progress: progress,
                    last-accessed: stacks-block-height,
                })
            ))
            err-not-found
        )
    )
)

;; Certificate Generation
(define-public (generate-certificate
        (course-id uint)
        (certificate-hash (string-ascii 64))
    )
    (let ((enrollment (get-enrollment tx-sender course-id)))
        (match enrollment
            enrollment-data (if (get completed enrollment-data)
                (ok (map-set enrollments {
                    student: tx-sender,
                    course-id: course-id,
                }
                    (merge enrollment-data { completion-certificate: (some certificate-hash) })
                ))
                err-unauthorized
            )
            err-not-found
        )
    )
)

;; Course Management
(define-public (create-course
        (title (string-ascii 100))
        (price uint)
        (content-hash (string-ascii 64))
        (category (string-ascii 50))
        (description (string-ascii 500))
        (prerequisites (list 10 uint))
    )
    (let (
            (course-id (var-get next-course-id))
            (instructor (get-instructor tx-sender))
        )
        (if (is-none instructor)
            err-unauthorized
            (begin
                (map-set courses { course-id: course-id } {
                    title: title,
                    instructor: tx-sender,
                    price: price,
                    content-hash: content-hash,
                    is-active: true,
                    category: category,
                    description: description,
                    total-students: u0,
                    average-rating: u0,
                    total-ratings: u0,
                    prerequisites: prerequisites,
                    created-at: stacks-block-height,
                })
                (var-set next-course-id (+ course-id u1))
                (ok course-id)
            )
        )
    )
)

;; Discussion Forum
(define-public (create-discussion-post
        (course-id uint)
        (content (string-ascii 500))
    )
    (let (
            (enrollment (get-enrollment tx-sender course-id))
            (post-id (var-get next-post-id))
        )
        (match enrollment
            enrollment-data (begin
                (map-set course-discussions {
                    course-id: course-id,
                    post-id: post-id,
                } {
                    author: tx-sender,
                    content: content,
                    timestamp: stacks-block-height,
                    replies: (list),
                    upvotes: u0,
                })
                (var-set next-post-id (+ post-id u1))
                (ok post-id)
            )
            err-unauthorized
        )
    )
)

(define-public (upvote-post
        (course-id uint)
        (post-id uint)
    )
    (let ((post (get-discussion-post course-id post-id)))
        (match post
            post-data (ok (map-set course-discussions {
                course-id: course-id,
                post-id: post-id,
            }
                (merge post-data { upvotes: (+ (get upvotes post-data) u1) })
            ))
            err-not-found
        )
    )
)

;; Instructor Earnings Management
(define-public (withdraw-earnings (amount uint))
    (let ((instructor-data (get-instructor tx-sender)))
        (match instructor-data
            data (let ((current-earnings (get total-earnings data)))
                (if (>= current-earnings amount)
                    (begin
                        (try! (stx-transfer? amount contract-owner tx-sender))
                        (ok (map-set instructor-details { instructor: tx-sender }
                            (merge data { total-earnings: (- current-earnings amount) })
                        ))
                    )
                    err-insufficient-balance
                )
            )
            err-not-found
        )
    )
)

;; Achievement System
(define-public (award-achievement
        (student principal)
        (achievement (string-ascii 50))
    )
    (if (is-eq tx-sender contract-owner)
        (let ((profile (get-student-profile student)))
            (match profile
                profile-data (ok (map-set student-profiles { student: student }
                    (merge profile-data { achievements: (unwrap!
                        (as-max-len?
                            (append (get achievements profile-data) achievement)
                            u10
                        )
                        err-invalid-input
                    ) }
                    )))
                err-not-found
            )
        )
        err-unauthorized
    )
)

;; Platform Fee Management
(define-public (set-platform-fee (new-fee uint))
    (if (and (is-eq tx-sender contract-owner) (<= new-fee u100))
        (ok (var-set platform-fee-percentage new-fee))
        err-unauthorized
    )
)
