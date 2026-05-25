from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
EDITOR_PAGES = [
    "computer-network.html",
    "design-patterns-topics.html",
    "guanlan.html",
    "learning-research-agent.html",
    "mysql-topics.html",
    "operating-system.html",
    "python.html",
    "redis-topics.html",
    "system-design-topics.html",
]


class EditModalMarkupTest(unittest.TestCase):
    def test_pages_use_button_and_modal_for_editing(self) -> None:
        for relative_path in EDITOR_PAGES:
            with self.subTest(page=relative_path):
                html = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn('id="edit-btn"', html)
                self.assertIn('id="edit-modal"', html)
                self.assertIn("function openEditModal()", html)
                self.assertNotIn("detailEl.addEventListener('dblclick'", html)
                self.assertNotIn('#detail-content[contenteditable="true"]', html)


if __name__ == "__main__":
    unittest.main()
