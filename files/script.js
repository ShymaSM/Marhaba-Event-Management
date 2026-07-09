// Initialize AOS (Animate On Scroll)
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            once: true,
            offset: 100,
        });
    }
});

const enquiryForm = document.getElementById('contactForm');

if (enquiryForm) {
    enquiryForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const formMessage = document.getElementById('formMessage');

        // Clear all previous error messages
        const errorSpans = document.querySelectorAll('.form-error');
        errorSpans.forEach(span => span.textContent = '');
        if (formMessage) {
            formMessage.textContent = '';
            formMessage.className = 'form-message';
        }

        // Get form values
        const formData = {
            fullName: document.getElementById('fullName').value.trim(),
            mobileNumber: document.getElementById('mobileNumber').value.trim(),
            email: document.getElementById('email').value.trim(),
            eventType: document.getElementById('eventType').value,
            eventDate: document.getElementById('eventDate').value,
            budget: document.getElementById('budget').value,
            message: document.getElementById('message').value.trim()
        };

        // 1. Professional Client-Side Validation
        let isValid = true;

        if (!formData.fullName || formData.fullName.length < 3) {
            document.getElementById('fullNameError').textContent = 'Please enter a valid full name (min 3 characters).';
            isValid = false;
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!formData.mobileNumber || !phoneRegex.test(formData.mobileNumber.replace(/\D/g, ''))) {
            document.getElementById('mobileNumberError').textContent = 'Please enter a valid 10-digit mobile number.';
            isValid = false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email || !emailRegex.test(formData.email)) {
            document.getElementById('emailError').textContent = 'Please enter a valid email address.';
            isValid = false;
        }

        if (!formData.eventType) {
            document.getElementById('eventTypeError').textContent = 'Please select an event type.';
            isValid = false;
        }

        if (!formData.eventDate) {
            document.getElementById('eventDateError').textContent = 'Please select an event date.';
            isValid = false;
        }

        if (!formData.budget) {
            document.getElementById('budgetError').textContent = 'Please select a budget range.';
            isValid = false;
        }

        if (!formData.message || formData.message.length < 10) {
            document.getElementById('messageError').textContent = 'Please provide more details in your message (min 10 characters).';
            isValid = false;
        }

        // Stop submission if validation fails
        if (!isValid) {
            if (formMessage) {
                formMessage.textContent = 'Please fix the errors above before submitting.';
                formMessage.className = 'form-message error';
            }
            return;
        }

        // 2. Loading State
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        try {
            // Determine API URL based on environment
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.');
            const API_URL = window.location.protocol === 'file:' || isLocal
                ? `http://${window.location.hostname === '' ? 'localhost' : window.location.hostname}:5000/api/enquiries` 
                : '/api/enquiries';

            // 3. API Submission
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            // Handle non-JSON responses gracefully
            let result;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                result = await response.json();
            } else {
                throw new Error('Server returned an invalid response. Is the backend running?');
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to send enquiry. Please try again.');
            }

            // 4. Success Handling
            if (formMessage) {
                formMessage.textContent = 'Thank you! Your enquiry has been sent successfully. We will contact you shortly.';
                formMessage.className = 'form-message success';
            } else {
                alert('Enquiry Sent Successfully');
            }

            enquiryForm.reset();

        } catch (error) {
            // 5. Error Handling
            console.error('Enquiry submission error:', error);

            if (formMessage) {
                // If it's a TypeError, it's likely a network issue (e.g. server is down)
                if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    formMessage.textContent = 'Network error: Cannot connect to the server. Please ensure the backend server is running.';
                } else {
                    formMessage.textContent = error.message || 'An unexpected error occurred. Please try again later.';
                }
                formMessage.className = 'form-message error';
            } else {
                alert('Unable to send enquiry. Please try again.');
            }

        } finally {
            // Remove loading state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

// Modal Logic (Using Event Delegation for Performance)
document.addEventListener('DOMContentLoaded', () => {
    const closeModal = (modal) => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    document.body.addEventListener('click', (e) => {
        // Open Modal
        const openBtn = e.target.closest('button[data-modal]');
        if (openBtn) {
            e.preventDefault();
            const modalId = openBtn.getAttribute('data-modal');
            const modal = document.querySelector(`.modal[data-modal="${modalId}"]`);
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
            return;
        }

        // Close Modal via X button
        const closeBtn = e.target.closest('.modal-close');
        if (closeBtn) {
            const modal = closeBtn.closest('.modal');
            if (modal) closeModal(modal);
            return;
        }

        // Close on click outside modal-content
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });
});

// Navigation & Scrolling Logic
document.addEventListener('DOMContentLoaded', () => {
    // Handle navigation and scrolling via Event Delegation
    document.body.addEventListener('click', (e) => {
        // Handle data-scroll buttons
        const scrollBtn = e.target.closest('[data-scroll]');
        if (scrollBtn) {
            e.preventDefault();
            const targetId = scrollBtn.getAttribute('data-scroll');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }

        // Handle nav links
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            const href = navLink.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }
                
                // Close mobile menu if open
                const navMenu = document.getElementById('navMenu');
                const hamburger = document.getElementById('hamburger');
                if (navMenu && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    if (hamburger) hamburger.classList.remove('active');
                }
            }
        }
    });

    // Handle Hamburger menu toggle
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Testimonial Slider Navigation
    const slider = document.querySelector('.testimonials-slider');
    const prevBtn = document.getElementById('prevTestimonial');
    const nextBtn = document.getElementById('nextTestimonial');

    if (slider && prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            const cardWidth = slider.querySelector('.testimonial-card').offsetWidth;
            slider.scrollBy({ left: -(cardWidth + 32), behavior: 'smooth' }); // width + gap
        });
        nextBtn.addEventListener('click', () => {
            const cardWidth = slider.querySelector('.testimonial-card').offsetWidth;
            slider.scrollBy({ left: cardWidth + 32, behavior: 'smooth' });
        });
    }
});
