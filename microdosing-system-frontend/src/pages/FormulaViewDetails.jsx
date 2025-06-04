import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Button,
  Tooltip,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/Delete";
import Swal from 'sweetalert2';

const FormulaViewDetails = () => {
  const { recipe_id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState({
    name: "",
    code: "",
    description: "",
    version: "",
    no_of_materials: 0,
    materials: []
  });

  const [materialNames, setMaterialNames] = useState({});

  useEffect(() => {
    const fetchRecipeData = async () => {
      try {
        const recipeResponse = await axios.get(`http://127.0.0.1:5000/api/recipes/${recipe_id}`);
        const fetchedRecipe = recipeResponse.data;
        const noOfMaterials = fetchedRecipe.no_of_materials ? Number(fetchedRecipe.no_of_materials) : 0;

        setRecipe((prev) => ({
          ...prev,
          ...fetchedRecipe,
          no_of_materials: noOfMaterials
        }));

        const materialsResponse = await axios.get(`http://127.0.0.1:5000/api/recipe_materials/${recipe_id}`);
        const materials = materialsResponse.data.materials;

        setRecipe((prev) => ({
          ...prev,
          materials: materials
        }));

        const namesMap = {};
        for (let material of materials) {
          try {
            const res = await axios.get(`http://127.0.0.1:5000/api/materials/${material.material_id}`);
            namesMap[material.material_id] = res.data.title;
          } catch (error) {
            console.error("Error fetching material name", error);
          }
        }
        setMaterialNames(namesMap);
      } catch (error) {
        console.error("Error fetching recipe or materials", error);
      }
    };

    fetchRecipeData();
  }, [recipe_id]);

  const moveRowUp = (index) => {
    if (index <= 0) return;
    const newMaterials = [...recipe.materials];
    [newMaterials[index - 1], newMaterials[index]] = [
      newMaterials[index],
      newMaterials[index - 1],
    ];
    setRecipe({ ...recipe, materials: newMaterials });
  };

  const moveRowDown = (index) => {
    if (index >= recipe.materials.length - 1) return;
    const newMaterials = [...recipe.materials];
    [newMaterials[index], newMaterials[index + 1]] = [
      newMaterials[index + 1],
      newMaterials[index],
    ];
    setRecipe({ ...recipe, materials: newMaterials });
  };

  const handleDelete = async (id) => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "Do you really want to delete this material?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
  });

  if (result.isConfirmed) {
    try {
      await axios.delete(`http://127.0.0.1:5000/api/recipe_materials/${id}`);
      const updatedMaterials = recipe.materials.filter(
        (mat) => mat.recipe_material_id !== id
      );
      setRecipe((prev) => ({
        ...prev,
        materials: updatedMaterials,
        no_of_materials: updatedMaterials.length
      }));

      await Swal.fire({
        title: 'Deleted!',
        text: 'Material has been deleted successfully.',
        icon: 'success',
        confirmButtonColor: '#16a34a',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error) {
      console.error("Error deleting material:", error);
      Swal.fire({
        title: 'Error!',
        text: 'Failed to delete material.',
        icon: 'error',
        confirmButtonColor: '#dc2626',
      });
    }
  }
};

  return (
    <Paper elevation={3} sx={{ maxWidth: 900, margin: "auto", mt: 4, p: 3 }}>
      <Typography variant="h6" align="center" gutterBottom>
        Formula Details
      </Typography>

      <Box mb={3}>
        <Typography><strong>Name:</strong> {recipe.name}</Typography>
        <Typography><strong>Code:</strong> {recipe.code}</Typography>
        <Typography><strong>Description:</strong> {recipe.description}</Typography>
        <Typography><strong>Version:</strong> {recipe.version}</Typography>
      </Box>

      <Box mt={2}>
        {recipe.materials.length > 0 ? (
          <Table sx={{ border: '1px solid #ccc', borderRadius: 1 }}>
            <TableHead sx={{ backgroundColor: '#d6dce5' }}>
              <TableRow>
                <TableCell><strong>Reorder</strong></TableCell>
                <TableCell><strong>Material</strong></TableCell>
                <TableCell><strong>Set Point</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recipe.materials.map((material, index) => (
                <TableRow key={material.recipe_material_id}>
                  <TableCell>
                    <Tooltip title="Move Up" arrow>
                      <span>
                        <IconButton
                          onClick={() => moveRowUp(index)}
                          disabled={index === 0}
                          size="small"
                          sx={{ color: "gray" }}
                        >
                          <ArrowUpwardIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Move Down" arrow>
                      <span>
                        <IconButton
                          onClick={() => moveRowDown(index)}
                          disabled={index === recipe.materials.length - 1}
                          size="small"
                          sx={{ color: "gray" }}
                        >
                          <ArrowDownwardIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{materialNames[material.material_id] || material.material_id}</TableCell>
                  <TableCell>{material.set_point}</TableCell>
                  <TableCell>
                    <Tooltip title="Delete Material" arrow>
                      <IconButton
                        onClick={() => handleDelete(material.recipe_material_id)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography align="center">No materials found for this formula.</Typography>
        )}
      </Box>

      <Box mt={4} display="flex" justifyContent="center">
        <Button variant="outlined" onClick={() => navigate(-1)}>Back</Button>
      </Box>
    </Paper>
  );
};

export default FormulaViewDetails;
