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

;; Read-only functions
(define-read-only (get-course (course-id uint))
    (map-get? courses { course-id: course-id })
)

(define-read-only (get-instructor (instructor principal))
    (map-get? instructor-details { instructor: instructor })
)

;; Public functions

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

;; Platform Fee Management
(define-public (set-platform-fee (new-fee uint))
    (if (and (is-eq tx-sender contract-owner) (<= new-fee u100))
        (ok (var-set platform-fee-percentage new-fee))
        err-unauthorized
    )
)
