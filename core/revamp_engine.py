"""
Revamp Engine Module
Unlimited video revamp with effect/color/timing rotation
"""

import logging
import os
import json
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

from core.project_info import PROJECT


class RevampEngine:
    """
    Unlimited Revamp System.
    Changes effects, colors, and timing based on user feedback.
    """
    
    def __init__(self):
        """Initialize revamp engine."""
        self.effects = ["neon_glow", "metallic_gold", "typewriter",
                        "bounce", "wave", "glitch"]
        
        self.color_schemes = {
            "gold": {
                "primary": (255, 215, 0),
                "secondary": (210, 210, 210),
                "background": (15, 20, 30)
            },
            "cyan": {
                "primary": (0, 255, 255),
                "secondary": (255, 255, 255),
                "background": (10, 20, 40)
            },
            "red": {
                "primary": (255, 100, 100),
                "secondary": (255, 200, 200),
                "background": (30, 15, 15)
            },
            "green": {
                "primary": (100, 255, 100),
                "secondary": (200, 255, 200),
                "background": (15, 30, 15)
            },
            "purple": {
                "primary": (200, 100, 255),
                "secondary": (230, 200, 255),
                "background": (25, 15, 35)
            }
        }
        
        self.revamp_history = []
        self.current_index = 0
    
    def revamp(self, video_data: Dict, user_feedback: str = "") -> Dict:
        """
        Revamp video based on user feedback.
        Unlimited revamps allowed.
        
        Args:
            video_data: Current video data
            user_feedback: User's feedback
            
        Returns:
            New video data with changes
        """
        # Save current state to history
        self.revamp_history.append(video_data.copy())
        
        # Determine what to change based on feedback
        changes = self._analyze_feedback(user_feedback)
        
        # Apply changes
        new_data = video_data.copy()
        
        if changes.get("change_effect"):
            new_data["effect"] = self._next_effect(video_data.get("effect"))
        
        if changes.get("change_color"):
            new_data["color"] = self._next_color(video_data.get("color"))
        
        if changes.get("change_timing"):
            new_data["timing"] = self._adjust_timing(video_data.get("timing"))
        
        # Increment revamp count
        new_data["revamp_count"] = video_data.get("revamp_count", 0) + 1
        
        # Add revamp timestamp
        from datetime import datetime
        new_data["last_revamp"] = datetime.now().isoformat()
        
        return new_data
    
    def _analyze_feedback(self, feedback: str) -> Dict:
        """
        Analyze user feedback to determine changes.
        
        Args:
            feedback: User's feedback text
            
        Returns:
            Dictionary of changes to apply
        """
        feedback_lower = feedback.lower()
        
        # Default: change everything
        changes = {
            "change_effect": True,
            "change_color": True,
            "change_timing": False
        }
        
        # Analyze specific feedback
        if "effect" in feedback_lower or "style" in feedback_lower:
            changes["change_effect"] = True
            changes["change_color"] = False
        
        elif "color" in feedback_lower or "colour" in feedback_lower:
            changes["change_color"] = True
            changes["change_effect"] = False
        
        elif "slow" in feedback_lower or "fast" in feedback_lower:
            changes["change_timing"] = True
            changes["change_effect"] = False
            changes["change_color"] = False
        
        elif "same" in feedback_lower:
            # Keep same effect and color
            changes["change_effect"] = False
            changes["change_color"] = False
        
        return changes
    
    def _next_effect(self, current_effect: str) -> str:
        """
        Get next effect in rotation.
        
        Args:
            current_effect: Current effect name
            
        Returns:
            Next effect name
        """
        if current_effect in self.effects:
            current_idx = self.effects.index(current_effect)
            next_idx = (current_idx + 1) % len(self.effects)
            return self.effects[next_idx]
        else:
            return self.effects[0]
    
    def _next_color(self, current_color: str) -> str:
        """
        Get next color scheme in rotation.
        
        Args:
            current_color: Current color scheme name
            
        Returns:
            Next color scheme name
        """
        colors = list(self.color_schemes.keys())
        
        if current_color in colors:
            current_idx = colors.index(current_color)
            next_idx = (current_idx + 1) % len(colors)
            return colors[next_idx]
        else:
            return colors[0]
    
    def _adjust_timing(self, current_timing: Dict) -> Dict:
        """
        Adjust timing parameters.
        
        Args:
            current_timing: Current timing dictionary
            
        Returns:
            Adjusted timing dictionary
        """
        if not current_timing:
            return {"duration": 7.0, "text_delay": 1.0}
        
        new_timing = current_timing.copy()
        
        # Alternate between faster and slower
        if self.current_index % 2 == 0:
            # Make faster
            new_timing["duration"] = max(5.0, new_timing.get("duration", 7.0) - 0.5)
            new_timing["text_delay"] = max(0.5, new_timing.get("text_delay", 1.0) - 0.2)
        else:
            # Make slower
            new_timing["duration"] = min(10.0, new_timing.get("duration", 7.0) + 0.5)
            new_timing["text_delay"] = min(2.0, new_timing.get("text_delay", 1.0) + 0.2)
        
        self.current_index += 1
        
        return new_timing
    
    def get_color_scheme(self, color_name: str) -> Dict:
        """
        Get color scheme by name.
        
        Args:
            color_name: Name of color scheme
            
        Returns:
            Color scheme dictionary
        """
        return self.color_schemes.get(color_name, self.color_schemes["gold"])
    
    def get_available_effects(self) -> List[str]:
        """Get list of available effects."""
        return self.effects.copy()
    
    def get_available_colors(self) -> List[str]:
        """Get list of available color schemes."""
        return list(self.color_schemes.keys())
    
    def get_revamp_history(self) -> List[Dict]:
        """Get revamp history."""
        return self.revamp_history.copy()
    
    def clear_history(self):
        """Clear revamp history."""
        self.revamp_history.clear()
        self.current_index = 0


# Test function
if __name__ == "__main__":
    print("Testing Revamp Engine...")
    
    engine = RevampEngine()
    
    # Test video data
    test_video = {
        "id": "test_video_001",
        "effect": "neon_glow",
        "color": "gold",
        "timing": {"duration": 7.0, "text_delay": 1.0},
        "revamp_count": 0
    }
    
    print(f"\nOriginal: {test_video}")
    
    # Test revamps
    feedbacks = [
        "Change the effect",
        "Try different colors",
        "Make it faster",
        "Change everything"
    ]
    
    for feedback in feedbacks:
        print(f"\nFeedback: {feedback}")
        test_video = engine.revamp(test_video, feedback)
        print(f"Revamped: {test_video}")
    
    # Show history
    print(f"\nRevamp History:")
    for idx, history in enumerate(engine.get_revamp_history(), 1):
        print(f"  {idx}. {history}")
    
    print("\nRevamp Engine Test Complete!")
