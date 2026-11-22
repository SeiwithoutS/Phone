import { resetAllSwipes } from './gestures.js'
import { controls } from '../runtime/state.js'

export function bindQzoneInteractions() {
  controls.postsList = document.getElementById('qzone-posts-list')

controls.swipeState = { isDragging: false, startX: 0, startY: 0, currentX: 0, activeContainer: null, swipeDirection: null, isClick: true }

controls.handleSwipeStart = (e) => {
            const target = e.target;
            
            if (target.closest('.post-footer, .post-feedback-icons, .post-actions-btn, .post-comments-container, .reposted-content-wrapper')) {
                return;
            }
            const targetContainer = e.target.closest('.qzone-post-container');
            if (!targetContainer) return;
        
            resetAllSwipes(targetContainer);
            controls.swipeState.activeContainer = targetContainer;
            controls.swipeState.isDragging = true;
            controls.swipeState.isClick = true;
            controls.swipeState.swipeDirection = null;
            controls.swipeState.startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
            controls.swipeState.startY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
            controls.swipeState.activeContainer.querySelector('.qzone-post-item').style.transition = 'none';
        
            
            document.addEventListener('mousemove', controls.handleSwipeMove);
            document.addEventListener('mouseup', controls.handleSwipeEnd);
            document.addEventListener('touchmove', controls.handleSwipeMove, { passive: false });
            document.addEventListener('touchend', controls.handleSwipeEnd);
        }

controls.handleSwipeMove = (e) => {
            if (!controls.swipeState.isDragging || !controls.swipeState.activeContainer) return;
        
            const currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
            const currentY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
            const diffX = currentX - controls.swipeState.startX;
            const diffY = currentY - controls.swipeState.startY;
            
            if (controls.swipeState.isClick && (Math.abs(diffX) > 5 || Math.abs(diffY) > 5)) {
                controls.swipeState.isClick = false;
            }
        
            if (!controls.swipeState.swipeDirection) {
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    controls.swipeState.swipeDirection = 'horizontal';
                } else {
                    controls.swipeState.swipeDirection = 'vertical';
                }
            }
            
            if (controls.swipeState.swipeDirection === 'horizontal') {
                e.preventDefault(); 
                controls.swipeState.currentX = currentX;
                let translation = Math.min(0, Math.max(-90, diffX)); 
                controls.swipeState.activeContainer.querySelector('.qzone-post-item').style.transform = `translateX(${translation}px)`;
            }
        }

controls.handleSwipeEnd = (e) => {
            
            document.removeEventListener('mousemove', controls.handleSwipeMove);
            document.removeEventListener('mouseup', controls.handleSwipeEnd);
            document.removeEventListener('touchmove', controls.handleSwipeMove);
            document.removeEventListener('touchend', controls.handleSwipeEnd);
        
            if (!controls.swipeState.isDragging || !controls.swipeState.activeContainer) return;
            
            const postItem = controls.swipeState.activeContainer.querySelector('.qzone-post-item');
            postItem.style.transition = 'transform 0.3s ease';
        
            if (controls.swipeState.swipeDirection === 'horizontal' && !controls.swipeState.isClick) {
                const finalX = e.type.includes('touchend') ? e.changedTouches[0].pageX : e.pageX;
                const diffX = finalX - controls.swipeState.startX;
                if (diffX < -40) { 
                    postItem.classList.add('swiped');
                } else {
                    postItem.classList.remove('swiped');
                }
            }
            
            postItem.style.transform = ''; 
            
            
            controls.swipeState.isDragging = false;
            controls.swipeState.activeContainer = null;
            controls.swipeState.swipeDirection = null;
            controls.swipeState.isClick = true;
        }
}
