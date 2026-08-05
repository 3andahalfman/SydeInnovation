const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CATEGORIES_FILE = path.join(__dirname, '../data/categories.json');

// Helper to read categories
const readCategories = () => {
  try {
    if (fs.existsSync(CATEGORIES_FILE)) {
      const data = fs.readFileSync(CATEGORIES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading categories:', error);
  }
  return { categories: [] };
};

// Helper to write categories
const writeCategories = (data) => {
  try {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing categories:', error);
    return false;
  }
};

// GET /api/categories - List all categories
router.get('/', (req, res) => {
  try {
    const data = readCategories();
    res.json({ success: true, categories: data.categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/categories - Create a new category
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    
    const data = readCategories();
    
    // Generate ID from name (lowercase, hyphenated)
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Check for duplicate
    if (data.categories.some(c => c.id === id)) {
      return res.status(400).json({ success: false, error: 'Category already exists' });
    }
    
    const newCategory = {
      id,
      name: name.trim(),
      description: description?.trim() || ''
    };
    
    data.categories.push(newCategory);
    
    if (writeCategories(data)) {
      res.json({ success: true, category: newCategory });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save category' });
    }
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/categories/:id - Update a category
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const data = readCategories();
    const index = data.categories.findIndex(c => c.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    
    // Update fields
    if (name && name.trim()) {
      data.categories[index].name = name.trim();
    }
    if (description !== undefined) {
      data.categories[index].description = description.trim();
    }
    
    if (writeCategories(data)) {
      res.json({ success: true, category: data.categories[index] });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save category' });
    }
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const data = readCategories();
    const index = data.categories.findIndex(c => c.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    
    const deleted = data.categories.splice(index, 1)[0];
    
    if (writeCategories(data)) {
      res.json({ success: true, deleted });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save categories' });
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
