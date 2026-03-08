import type { Request, Response } from "express";

import db from "../models";

const toId = (value: unknown): number => Number.parseInt(String(value), 10);

export const listing = async (_req: Request, res: Response) => {
  try {
    const count = await db.MappingQuestion.count();
    const questions = await db.MappingQuestion.findAll({
      include: db.MappingOption,
      order: [
        ["position", "ASC"],
        [db.MappingOption, "position", "ASC"],
      ],
    });

    return res.send({ count, questions });
  } catch (error) {
    return res.send(error);
  }
};

export const create = async (req: Request, res: Response) => {
  const { title, type, position } = req.body as {
    title: string;
    type: string;
    position: number;
  };

  try {
    const question = await db.MappingQuestion.create({ title, type, position });
    return res.send(question);
  } catch (error) {
    return res.status(400).send(error);
  }
};

export const update = async (req: Request, res: Response) => {
  const id = toId(req.params.id);

  try {
    const question = await db.MappingQuestion.findByPk(id, { include: "MappingOptions" });
    if (!question) {
      return res.status(404).send(new Error(`MappingQuestion ${id} not found`));
    }

    const { title, type, position } = req.body as {
      title?: string;
      type?: string;
      position?: number;
    };

    try {
      await question.update({
        ...(title !== undefined ? { title } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(position !== undefined ? { position } : {}),
      });

      return res.send(question);
    } catch (error) {
      return res.status(400).send(error);
    }
  } catch (error) {
    return res.status(400).send(error);
  }
};

export const remove = async (req: Request, res: Response) => {
  const id = toId(req.params.id);

  try {
    const question = await db.MappingQuestion.findByPk(id, { include: "MappingOptions" });
    if (!question) {
      return res.status(404).send(new Error(`MappingQuestion ${id} not found`));
    }

    try {
      await question.destroy();
      return res.send(question);
    } catch (error) {
      return res.status(400).send(error);
    }
  } catch (error) {
    return res.status(400).send(error);
  }
};

export const listOptions = async (req: Request, res: Response) => {
  const id = toId(req.params.id);

  try {
    const count = await db.MappingOption.count({ where: { mappingQuestionId: id } });
    const options = await db.MappingOption.findAll({
      where: { mappingQuestionId: id },
      order: [["position", "ASC"]],
    });

    return res.send({ count, options });
  } catch (error) {
    return res.send(error);
  }
};

export const createOption = async (req: Request, res: Response) => {
  const id = toId(req.params.id);
  const { title, position, color } = req.body as {
    title: string;
    position: number;
    color?: string;
  };

  try {
    const option = await db.MappingOption.create({
      title,
      position,
      color,
      mappingQuestionId: id,
    });

    return res.send(option);
  } catch (error) {
    return res.status(400).send(error);
  }
};

export const updateOption = async (req: Request, res: Response) => {
  const id = toId(req.params.optionId);

  try {
    const option = await db.MappingOption.findByPk(id);
    if (!option) {
      return res.status(404).send(new Error(`MappingOption ${id} not found`));
    }

    const { title, color, position } = req.body as {
      title?: string;
      color?: string;
      position?: number;
    };

    try {
      await option.update({
        ...(title !== undefined ? { title } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(position !== undefined ? { position } : {}),
      });

      return res.send(option);
    } catch (error) {
      return res.status(400).send(error);
    }
  } catch (error) {
    return res.status(400).send(error);
  }
};

export const removeOption = async (req: Request, res: Response) => {
  const id = toId(req.params.optionId);

  try {
    const option = await db.MappingOption.findByPk(id);
    if (!option) {
      return res.status(404).send(new Error(`MappingOption ${id} not found`));
    }

    try {
      await option.destroy();
      return res.send(option);
    } catch (error) {
      return res.status(400).send(error);
    }
  } catch (error) {
    return res.status(400).send(error);
  }
};
