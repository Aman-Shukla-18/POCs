import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, TextField, Select, SelectOption } from '../../../shared/ui';
import { TodosStackScreenProps } from '../../../app/navigation/types';
import { todoRepository } from '../repository';
import { categoryRepository } from '../../categories/repository';
import type Category from '../../../db/models/Category';

type Props = TodosStackScreenProps<'TodoForm'>;

export const TodoFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const todoId = route.params?.todoId;
  const isEditing = !!todoId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState<{ title?: string }>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load categories
        const cats = await categoryRepository.getAll();
        setCategories(cats);

        // Load existing todo if editing
        if (todoId) {
          const todo = await todoRepository.getById(todoId);
          if (todo) {
            setTitle(todo.title);
            setDescription(todo.description || '');
            setCategoryId(todo.categoryId || '');
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [todoId]);

  const validate = (): boolean => {
    const newErrors: { title?: string } = {};
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEditing && todoId) {
        await todoRepository.update(todoId, {
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId: categoryId || undefined,
        });
      } else {
        await todoRepository.create({
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId: categoryId || undefined,
        });
      }
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save todo:', err);
      Alert.alert('Error', 'Failed to save todo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions: SelectOption[] = [
    { label: 'No category', value: '' },
    ...categories.map((cat) => ({
      label: cat.title,
      value: cat.id,
    })),
  ];

  if (initialLoading) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter todo title"
          error={errors.title}
          autoFocus={!isEditing}
        />

        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Enter description (optional)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Select
          label="Category"
          options={categoryOptions}
          selectedValue={categoryId}
          onValueChange={setCategoryId}
          placeholder="Select a category"
        />

        <Button
          title={isEditing ? 'Update' : 'Save'}
          onPress={handleSave}
          loading={loading}
          style={styles.saveButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
  },
  saveButton: {
    marginTop: 16,
  },
});
