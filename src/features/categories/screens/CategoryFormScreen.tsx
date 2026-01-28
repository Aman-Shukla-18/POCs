import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, TextField } from '../../../shared/ui';
import { CategoriesStackScreenProps } from '../../../app/navigation/types';
import { categoryRepository } from '../repository';

type Props = CategoriesStackScreenProps<'CategoryForm'>;

export const CategoryFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const categoryId = route.params?.categoryId;
  const isEditing = !!categoryId;

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState<{ title?: string }>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        if (categoryId) {
          const category = await categoryRepository.getById(categoryId);
          if (category) {
            setTitle(category.title);
          }
        }
      } catch (err) {
        console.error('Failed to load category:', err);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [categoryId]);

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
      if (isEditing && categoryId) {
        await categoryRepository.update(categoryId, {
          title: title.trim(),
        });
      } else {
        await categoryRepository.create({
          title: title.trim(),
        });
      }
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save category:', err);
      Alert.alert('Error', 'Failed to save category. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          placeholder="Enter category title"
          error={errors.title}
          autoFocus={!isEditing}
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
